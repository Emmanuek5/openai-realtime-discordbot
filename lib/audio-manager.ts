import {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayer,
  VoiceConnection,
  StreamType,
  VoiceReceiver,
  EndBehaviorType,
  AudioPlayerStatus,
} from "@discordjs/voice";
import type { Guild, VoiceBasedChannel, User } from "discord.js";
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import prism from "prism-media";

import fs from "fs";

export interface GuildAudioSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  realtimeSession?: RealtimeSession;
  audioStream?: Readable;
  receiver?: VoiceReceiver;
  currentAudioStream?: Readable | null;
  responseAudioChunks?: Buffer[];
  pendingFunctionCalls?: Map<string, any>; // Track function calls by call_id
  isAiSpeaking?: boolean; // Track when AI is actively speaking
  isMuted?: boolean; // Track if AI is temporarily muted
  notes?: Array<{ timestamp: Date; content: string; category: string }>; // Conversation notes
}

export class AudioManager {
  private sessions: Map<string, GuildAudioSession> = new Map();

  getSession(guildId: string): GuildAudioSession | undefined {
    const existing = this.sessions.get(guildId);
    if (existing) return existing;
    const existingConn = getVoiceConnection(guildId);
    if (!existingConn) return undefined;
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    existingConn.subscribe(player);
    const session = { connection: existingConn, player };
    this.sessions.set(guildId, session);
    return session;
  }

  connectToChannel(channel: VoiceBasedChannel): {
    session: GuildAudioSession;
    isNew: boolean;
  } {
    if (!channel.guild) {
      throw new Error("Channel must belong to a guild");
    }
    const guild: Guild = channel.guild;
    const guildId = guild.id;

    const current = this.getSession(guildId);
    if (current) {
      return { session: current, isNew: false };
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator as any,
      selfDeaf: false,
      selfMute: false,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    connection.subscribe(player);

    const session: GuildAudioSession = { connection, player };
    this.sessions.set(guildId, session);
    return { session, isNew: true };
  }

  leave(guildId: string): boolean {
    const existing = this.sessions.get(guildId);
    if (!existing) {
      const conn = getVoiceConnection(guildId);
      if (conn) conn.destroy();
      return false;
    }
    try {
      existing.connection.destroy();
    } finally {
      this.sessions.delete(guildId);
    }
    return true;
  }

  async setMute(guild: Guild, mute: boolean): Promise<boolean> {
    const me = guild.members.me;
    if (!me || !me.voice.channel) return false;
    await me.voice.setMute(mute);
    return true;
  }

  async setDeaf(guild: Guild, deaf: boolean): Promise<boolean> {
    const me = guild.members.me;
    if (!me || !me.voice.channel) return false;
    await me.voice.setDeaf(deaf);
    return true;
  }

  async mute(guild: Guild): Promise<boolean> {
    return this.setMute(guild, true);
  }

  async unmute(guild: Guild): Promise<boolean> {
    return this.setMute(guild, false);
  }

  async deaf(guild: Guild): Promise<boolean> {
    return this.setDeaf(guild, true);
  }

  async undeaf(guild: Guild): Promise<boolean> {
    return this.setDeaf(guild, false);
  }

  async startRealtimeCall(
    guildId: string,
    options?: {
      instructions?: string;
      voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    }
  ): Promise<boolean> {
    console.log(`🔧 Starting realtime call for guild ${guildId}...`);

    const session = this.getSession(guildId);
    if (!session) {
      console.error(`❌ No session found for guild ${guildId}`);
      return false;
    }

    // Don't start if already running
    if (session.realtimeSession) {
      console.log(`⚠️  Realtime call already active for guild ${guildId}`);
      return false;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY not found in environment variables");
      return false;
    }

    try {
      console.log("🤖 Creating realtime agent...");

      // Create the realtime agent
      const agent = new RealtimeAgent({
        name: "Discord Assistant",
        instructions:
          options?.instructions ||
          "You are a helpful voice assistant in a Discord server. Be conversational and friendly. Keep responses concise but natural.",
      });

      console.log("🔗 Creating realtime session...");

      // Create realtime session with WebSocket transport
      const realtimeSession = new RealtimeSession(agent, {
        transport: "websocket",
        model: "gpt-realtime",
      });

      console.log("🌐 Connecting to OpenAI...");

      // Connect to OpenAI
      await realtimeSession.connect({ apiKey });
      console.log("✅ Connected to OpenAI Realtime API");

      // Configure session after connection
      await this.configureSession(realtimeSession, options?.voice);

      // Set up extensive event logging
      this.setupRealtimeEventLogging(realtimeSession, guildId);

      // Handle audio from OpenAI -> Discord
      session.currentAudioStream = null;
      session.responseAudioChunks = [];
      session.pendingFunctionCalls = new Map();
      session.isAiSpeaking = false;
      session.isMuted = false;
      session.notes = [];

      realtimeSession.on("audio", (event) => {
        const audioBuffer = Buffer.from(event.data);
        console.log(`🎵 Received ${audioBuffer.length} bytes from OpenAI`);

        // Convert OpenAI audio (24kHz mono) to Discord format (48kHz stereo)
        const discordAudio = this.convertOpenAIToDiscord(audioBuffer);

        // Collect audio chunks for this response
        session.responseAudioChunks?.push(discordAudio);
      });

      // Initially, player is idle and waiting for first response
      console.log("🎮 Audio player ready, waiting for first response");

      // Debug audio playback and track AI speaking state
      session.player.on("stateChange", (oldState, newState) => {
        console.log(
          `🔊 Audio player: ${oldState.status} -> ${newState.status}`
        );

        // Track when AI starts speaking
        if (newState.status === AudioPlayerStatus.Playing) {
          session.isAiSpeaking = true;
          console.log("🤖 AI started speaking - user input blocked");
        }

        // Track when AI stops speaking
        if (
          newState.status === AudioPlayerStatus.Idle &&
          oldState.status === AudioPlayerStatus.Playing
        ) {
          session.isAiSpeaking = false;
          console.log("🔄 AI finished speaking - user input enabled");
        }
      });

      session.player.on("error", (error) => {
        console.error("❌ Audio player error:", error);
      });

      // Set up voice input capture from Discord
      const receiver = session.connection.receiver;

      // Listen for users speaking
      receiver.speaking.on("start", (userId) => {
        // Only process user speech if AI is not currently speaking
        if (!session.isAiSpeaking) {
          this.handleUserSpeaking(userId, receiver, realtimeSession, guildId);
        } else {
          console.log(
            `🔇 Ignoring user speech from ${userId} - AI is speaking`
          );
        }
      });

      // Store in session
      session.realtimeSession = realtimeSession;
      session.receiver = receiver;

      console.log(
        `✅ Started realtime call for guild ${guildId} with voice "${
          options?.voice || "alloy"
        }"`
      );

      // Set up error handling
      realtimeSession.on("error", (error) => {
        console.error("❌ Realtime session error:", error);
      });

      console.log(
        "👋 Audio-only mode ready! Start speaking to begin conversation."
      );

      return true;
    } catch (error) {
      console.error("❌ Failed to start realtime call:", error);
      console.error("Error details:", error);
      return false;
    }
  }

  private async configureSession(session: RealtimeSession, voice?: string) {
    console.log("⚙️  Configuring session...");

    // Send session.update event to configure the session properly
    const sessionConfig = {
      type: "session.update",
      session: {
        type: "realtime",
        model: "gpt-realtime",
        output_modalities: ["audio"],
        audio: {
          input: {
            turn_detection: {
              type: "server_vad",
              threshold: 0.8,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000,
              create_response: false,
            },
          },
          output: {
            voice: voice || "alloy",
            speed: 1.0,
          },
        },
        tools: [
          {
            type: "function",
            name: "end_call",
            description:
              "End the current voice call session when the user asks to stop, hang up, or end the call.",
            parameters: {
              type: "object",
              strict: true,
              properties: {
                reason: {
                  type: "string",
                  description:
                    "The reason for ending the call (e.g., 'user requested', 'conversation complete')",
                },
              },
              required: ["reason"],
            },
          },
          {
            type: "function",
            name: "mute_self",
            description:
              "Temporarily mute yourself (stop speaking) while continuing to listen to the user. Use when you need to pause, think, or let the user speak uninterrupted.",
            parameters: {
              type: "object",
              strict: true,
              properties: {
                duration_seconds: {
                  type: "number",
                  description:
                    "How long to stay muted in seconds (default: 5, max: 30)",
                },
                reason: {
                  type: "string",
                  description:
                    "Why you're muting (e.g., 'thinking', 'letting user speak', 'processing')",
                },
              },
              required: ["reason"],
            },
          },
          {
            type: "function",
            name: "take_notes",
            description:
              "Save important points, decisions, or action items from the conversation for later reference.",
            parameters: {
              type: "object",
              strict: true,
              properties: {
                note_content: {
                  type: "string",
                  description: "The important information to save",
                },
                category: {
                  type: "string",
                  enum: [
                    "action_item",
                    "decision",
                    "idea",
                    "reminder",
                    "important_info",
                  ],
                  description: "Type of note being saved",
                },
              },
              required: ["note_content", "category"],
            },
          },
        ],
        tool_choice: "auto",
        instructions:
          "You are a helpful voice assistant in a Discord server. Be conversational and friendly. Keep responses concise but natural. Available tools: 1) Use 'end_call' when users want to stop/hang up. 2) Use 'mute_self' to pause and listen when you need to think or let the user speak uninterrupted. 3) Use 'take_notes' to save important information, decisions, or action items from the conversation.",
      },
    };

    // Send the configuration via transport
    session.transport.sendEvent(sessionConfig);
    console.log("✅ Session configured with end_call function");
  }

  private setupRealtimeEventLogging(session: RealtimeSession, guildId: string) {
    try {
      // Enhanced event logging with response tracking
      session.transport.on("*", (event: any) => {
        fs.writeFileSync(`events.json`, JSON.stringify(event, null, 2));

        // Log important session and response events
        if (event.type === "session.created") {
          console.log("🎯 Session created");
        }
        if (event.type === "session.updated") {
          console.log("⚙️  Session updated");
        }
        if (event.type === "input_audio_buffer.speech_started") {
          console.log("🎤 Speech detected");
        }
        if (event.type === "input_audio_buffer.speech_stopped") {
          console.log("🔇 Speech ended");
        }
        if (event.type === "response.created") {
          console.log("🆕 AI generating response...");
        }
        if (event.type === "response.audio.delta" && event.delta?.length > 0) {
          console.log("🎵 AI speaking...");
        }
        if (
          event.type === "response.output_item.added" &&
          event.item?.type === "function_call"
        ) {
          console.log("🔧 Function call started:", event.item.name);
          // Initialize function call tracking
          const currentSession = this.getSession(guildId);
          if (currentSession?.pendingFunctionCalls) {
            currentSession.pendingFunctionCalls.set(event.item.call_id, {
              call_id: event.item.call_id,
              name: event.item.name,
              arguments: "",
            });
          }
        }
        if (event.type === "response.function_call_arguments.delta") {
          console.log("🔧 Function call arguments delta:", event.delta);
          // Accumulate function call arguments
          const currentSession = this.getSession(guildId);
          if (currentSession?.pendingFunctionCalls) {
            const existingCall = currentSession.pendingFunctionCalls.get(
              event.call_id
            ) || {
              call_id: event.call_id,
              name: "",
              arguments: "",
            };
            existingCall.arguments += event.delta;
            currentSession.pendingFunctionCalls.set(
              event.call_id,
              existingCall
            );
          }
        }
        if (event.type === "response.function_call_arguments.done") {
          console.log("🔧 Function call arguments done:", event.arguments);
          this.handleFunctionCall(guildId, event.call_id, event.arguments);
        }
        if (event.type === "response.done") {
          console.log("✅ AI response completed");

          // Play the collected audio response (unless muted)
          const currentSession = this.getSession(guildId);
          if (
            currentSession?.responseAudioChunks &&
            currentSession.responseAudioChunks.length > 0 &&
            !currentSession.isMuted
          ) {
            console.log(
              `🎵 Playing response with ${currentSession.responseAudioChunks.length} audio chunks`
            );

            // Create a fresh audio stream for this response
            currentSession.currentAudioStream = this.createFreshAudioStream();

            // Combine all audio chunks
            const totalLength = currentSession.responseAudioChunks.reduce(
              (sum: number, chunk: Buffer) => sum + chunk.length,
              0
            );
            const combinedAudio = Buffer.allocUnsafe(totalLength);
            let offset = 0;
            for (const chunk of currentSession.responseAudioChunks) {
              combinedAudio.set(new Uint8Array(chunk), offset);
              offset += chunk.length;
            }

            // Push the complete response to the stream
            currentSession.currentAudioStream.push(combinedAudio);
            currentSession.currentAudioStream.push(null); // End the stream

            // Create and play the audio resource
            const resource = createAudioResource(
              currentSession.currentAudioStream,
              {
                inputType: StreamType.Raw,
                inlineVolume: true,
              }
            );
            resource.volume?.setVolume(1.0);
            currentSession.player.play(resource);

            // Reset for next response
            currentSession.responseAudioChunks = [];
          } else if (
            currentSession?.isMuted &&
            (currentSession?.responseAudioChunks?.length || 0) > 0
          ) {
            console.log("🔇 Skipping audio playback - AI is muted");
            // Still clear the chunks even when muted
            currentSession.responseAudioChunks = [];
          }

          console.log("🔄 Ready for next user input");
        }
        if (event.type === "error") {
          console.error("❌ Realtime API error:", event.error);
        }
      });
    } catch (error) {
      console.log(
        "⚠️  Wildcard event listener not available, using basic logging"
      );
    }
  }

  private handleUserSpeaking(
    userId: string,
    receiver: VoiceReceiver,
    realtimeSession: RealtimeSession,
    guildId?: string
  ) {
    // Double-check that AI is not speaking before processing
    if (guildId) {
      const session = this.getSession(guildId);
      if (session?.isAiSpeaking) {
        console.log(
          `🔇 Aborting user speech processing for ${userId} - AI is speaking`
        );
        return;
      }
    }

    console.log(`🎤 Processing speech from user ${userId}`);
    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1500,
      },
    });

    let pcmBuffers: Buffer[] = [];

    // Create Opus decoder pipeline
    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    opusStream.pipe(decoder);

    decoder.on("data", (pcmChunk: Buffer) => {
      try {
        // Convert from 48kHz stereo to 16kHz mono for OpenAI
        const mono16k = this.convertAudioFormat(pcmChunk);
        if (mono16k.length > 0) {
          pcmBuffers.push(mono16k);
        }
      } catch (error) {
        console.error("❌ Audio format conversion failed:", error);
      }
    });

    decoder.on("end", () => {
      if (pcmBuffers.length > 0) {
        // Manually concatenate buffers
        const totalLength = pcmBuffers.reduce(
          (sum, buf) => sum + buf.length,
          0
        );
        const combinedPcm = Buffer.allocUnsafe(totalLength);
        let offset = 0;
        for (const buffer of pcmBuffers) {
          combinedPcm.set(new Uint8Array(buffer), offset);
          offset += buffer.length;
        }

        try {
          // Convert to base64 for input_audio_buffer.append
          const base64Audio = combinedPcm.toString("base64");

          // Send via input_audio_buffer.append as per API docs
          realtimeSession.transport.sendEvent({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          });

          // Commit the audio buffer
          realtimeSession.transport.sendEvent({
            type: "input_audio_buffer.commit",
          });

          // Request a response from the model
          realtimeSession.transport.sendEvent({
            type: "response.create",
          });

          console.log(
            `📤 Sent ${Math.round(combinedPcm.length / 1000)}KB audio to OpenAI`
          );
        } catch (error) {
          console.error("❌ Failed to send audio to OpenAI:", error);
        }
      }
    });

    decoder.on("error", (error) => {
      console.error(`❌ Audio decoder error for user ${userId}:`, error);
    });

    opusStream.on("error", (error) => {
      console.error(`❌ Audio stream error for user ${userId}:`, error);
    });
  }

  // Convert OpenAI audio (24kHz mono) to Discord format (48kHz stereo)
  private convertOpenAIToDiscord(input: Buffer): Buffer {
    try {
      // Input: 24kHz mono 16-bit PCM from OpenAI
      // Output: 48kHz stereo 16-bit PCM for Discord

      const inputSamples = input.length / 2; // 2 bytes per sample
      const outputSamples = inputSamples * 2; // Upsample 24kHz -> 48kHz
      const output = Buffer.allocUnsafe(outputSamples * 4); // 4 bytes per stereo sample

      for (let i = 0; i < inputSamples; i++) {
        // Read mono sample from OpenAI
        const sample = input.readInt16LE(i * 2);

        // Upsample: write each sample twice (24kHz -> 48kHz)
        const outputIndex1 = i * 2 * 4; // First upsampled position
        const outputIndex2 = (i * 2 + 1) * 4; // Second upsampled position

        if (outputIndex2 + 3 < output.length) {
          // Write stereo samples (left and right channels identical)
          output.writeInt16LE(sample, outputIndex1); // Left channel
          output.writeInt16LE(sample, outputIndex1 + 2); // Right channel
          output.writeInt16LE(sample, outputIndex2); // Left channel (duplicate)
          output.writeInt16LE(sample, outputIndex2 + 2); // Right channel (duplicate)
        }
      }

      return output;
    } catch (error) {
      console.error("❌ OpenAI to Discord audio conversion failed:", error);
      return input; // Return original if conversion fails
    }
  }

  // Convert 48kHz stereo PCM to 16kHz mono PCM for OpenAI
  private convertAudioFormat(input: Buffer): Buffer {
    try {
      // Input: 48kHz stereo 16-bit PCM
      // Output: 16kHz mono 16-bit PCM

      const inputSamples = input.length / 4; // 2 bytes per sample * 2 channels
      const outputSamples = Math.floor(inputSamples / 3); // 48kHz -> 16kHz downsampling
      const output = Buffer.allocUnsafe(outputSamples * 2); // 2 bytes per mono sample

      for (let i = 0; i < outputSamples; i++) {
        const inputIndex = i * 3 * 4; // Skip samples for downsampling, 4 bytes per stereo sample

        if (inputIndex + 3 < input.length) {
          // Read left and right channels (16-bit signed)
          const left = input.readInt16LE(inputIndex);
          const right = input.readInt16LE(inputIndex + 2);

          // Convert to mono by averaging
          const mono = Math.floor((left + right) / 2);

          // Write mono sample
          output.writeInt16LE(mono, i * 2);
        }
      }

      return output.subarray(0, outputSamples * 2);
    } catch (error) {
      console.error("❌ Audio format conversion failed:", error);
      return Buffer.alloc(0);
    }
  }

  async stopRealtimeCall(guildId: string): Promise<boolean> {
    const session = this.getSession(guildId);
    if (!session || !session.realtimeSession) return false;

    try {
      console.log(`🔇 Stopping realtime call for guild ${guildId}...`);

      // Stop the audio player first
      session.player.stop();
      console.log("🛑 Audio player stopped");

      // End any current audio streams
      if (session.audioStream) {
        session.audioStream.push(null); // End stream
        session.audioStream = undefined;
      }

      if (session.currentAudioStream) {
        session.currentAudioStream.push(null); // End stream
        session.currentAudioStream = undefined;
      }

      // Clear audio buffers and function calls
      session.responseAudioChunks = [];
      session.pendingFunctionCalls?.clear();
      session.isAiSpeaking = false;
      session.isMuted = false;

      // Try to properly disconnect from OpenAI Realtime API
      if (session.realtimeSession) {
        try {
          // Remove all event listeners to prevent memory leaks
          session.realtimeSession.removeAllListeners();
          console.log("🧹 Removed realtime session event listeners");
        } catch (error) {
          console.warn(
            "⚠️  Could not remove realtime session listeners:",
            error
          );
        }

        // Clear the realtime session reference
        session.realtimeSession = undefined;
        console.log("🔌 Disconnected from OpenAI Realtime API");
      }

      // Clear receiver reference
      session.receiver = undefined;

      console.log(`✅ Successfully stopped realtime call for guild ${guildId}`);
      //disconnect from the voice channel
      session.connection.destroy();
      console.log("🔌 Disconnected from voice channel");

      return true;
    } catch (error) {
      console.error("❌ Failed to stop realtime call:", error);
      return false;
    }
  }

  // Send Discord user audio to OpenAI
  sendAudioToOpenAI(guildId: string, audioBuffer: ArrayBuffer): boolean {
    const session = this.getSession(guildId);
    if (!session?.realtimeSession) return false;

    try {
      session.realtimeSession.sendAudio(audioBuffer);
      return true;
    } catch (error) {
      console.error("Failed to send audio to OpenAI:", error);
      return false;
    }
  }

  // Check if realtime call is active
  isRealtimeCallActive(guildId: string): boolean {
    const session = this.getSession(guildId);
    return !!session?.realtimeSession;
  }

  // Handle function calls from the AI
  private async handleFunctionCall(
    guildId: string,
    callId: string,
    argumentsJson: string
  ) {
    try {
      const args = JSON.parse(argumentsJson);
      console.log(`🔧 Handling function call ${callId} with args:`, args);

      const session = this.getSession(guildId);
      if (!session?.realtimeSession) {
        console.error("❌ No active session for function call");
        return;
      }

      // Get the function name from pending function calls
      const pendingCall = session.pendingFunctionCalls?.get(callId);
      const functionName = pendingCall?.name || this.inferFunctionName(args);

      let functionResponse: any;

      switch (functionName) {
        case "end_call":
          functionResponse = await this.handleEndCall(guildId, callId, args);
          break;

        case "mute_self":
          functionResponse = await this.handleMuteSelf(guildId, callId, args);
          break;

        case "take_notes":
          functionResponse = await this.handleTakeNotes(guildId, callId, args);
          break;

        default:
          console.error(`❌ Unknown function: ${functionName}`);
          functionResponse = {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({
                success: false,
                error: `Unknown function: ${functionName}`,
              }),
            },
          };
      }

      // Send the function response back to AI
      if (functionResponse) {
        session.realtimeSession.transport.sendEvent(functionResponse);
        console.log(`✅ Sent ${functionName} response to AI`);
      }

      // Clean up the pending function call
      if (session.pendingFunctionCalls) {
        session.pendingFunctionCalls.delete(callId);
      }
    } catch (error) {
      console.error("❌ Error handling function call:", error);
    }
  }

  // Infer function name from arguments (fallback method)
  private inferFunctionName(args: any): string {
    if (
      args.reason !== undefined &&
      args.duration_seconds === undefined &&
      args.note_content === undefined
    ) {
      return "end_call";
    }
    if (args.duration_seconds !== undefined) {
      return "mute_self";
    }
    if (args.note_content !== undefined) {
      return "take_notes";
    }
    return "unknown";
  }

  // Handle end_call function
  private async handleEndCall(guildId: string, callId: string, args: any) {
    console.log(`📞 AI requested to end call: ${args.reason}`);

    // End the call after a brief delay to allow AI to respond
    setTimeout(async () => {
      const success = await this.stopRealtimeCall(guildId);
      if (success) {
        console.log("✅ Call ended via AI function call");
      } else {
        console.error("❌ Failed to end call via AI function call");
      }
    }, 2000); // 2 second delay to allow AI to acknowledge

    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({
          success: true,
          message: "Call ended successfully. Goodbye!",
        }),
      },
    };
  }

  // Handle mute_self function
  private async handleMuteSelf(guildId: string, callId: string, args: any) {
    const duration = Math.min(args.duration_seconds || 5, 30); // Max 30 seconds
    const reason = args.reason || "thinking";

    console.log(`🔇 AI requested to mute for ${duration}s: ${reason}`);

    const session = this.getSession(guildId);
    if (session) {
      session.isMuted = true;

      // Unmute after the specified duration
      setTimeout(() => {
        if (session) {
          session.isMuted = false;
          console.log("🔊 AI unmuted automatically");
        }
      }, duration * 1000);
    }

    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({
          success: true,
          message: `Muted for ${duration} seconds. Listening...`,
          duration_seconds: duration,
          reason: reason,
        }),
      },
    };
  }

  // Handle take_notes function
  private async handleTakeNotes(guildId: string, callId: string, args: any) {
    const noteContent = args.note_content;
    const category = args.category || "important_info";

    console.log(`📝 AI taking note [${category}]: ${noteContent}`);

    const session = this.getSession(guildId);
    if (session && session.notes) {
      const note = {
        timestamp: new Date(),
        content: noteContent,
        category: category,
      };

      session.notes.push(note);

      // Save to file as well
      try {
        const notesFile = `notes_${guildId}.json`;
        fs.writeFileSync(notesFile, JSON.stringify(session.notes, null, 2));
      } catch (error) {
        console.error("❌ Failed to save notes to file:", error);
      }
    }

    return {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({
          success: true,
          message: `Note saved: [${category}] ${noteContent}`,
          note_count: session?.notes?.length || 0,
        }),
      },
    };
  }

  // Create a fresh audio stream for Discord playback
  private createFreshAudioStream(): Readable {
    const stream = new Readable({
      read() {}, // No-op
    });

    stream.on("end", () => {
      console.log("📻 Audio stream ended");
    });

    stream.on("error", (error) => {
      console.error("❌ Audio stream error:", error);
    });

    return stream;
  }
}
