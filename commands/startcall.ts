import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import type { Command } from "../types/main";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("startcall")
    .setDescription(
      "Start a realtime AI voice call in your current voice channel."
    )
    .addStringOption((option) =>
      option
        .setName("voice")
        .setDescription("Choose the AI voice")
        .addChoices(
          { name: "Alloy (Default)", value: "alloy" },
          { name: "Echo", value: "echo" },
          { name: "Fable", value: "fable" },
          { name: "Onyx", value: "onyx" },
          { name: "Nova", value: "nova" },
          { name: "Shimmer", value: "shimmer" }
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("instructions")
        .setDescription("Custom instructions for the AI assistant")
        .setRequired(false)
    ) as SlashCommandBuilder,
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "You must be connected to a voice channel to start a call.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const botMember = interaction.guild!.members.me;
    if (
      !botMember
        ?.permissionsIn(voiceChannel)
        .has(PermissionsBitField.Flags.Connect)
    ) {
      await interaction.reply({
        content: "I don't have permission to connect to that channel.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    if (
      !botMember
        .permissionsIn(voiceChannel)
        .has(PermissionsBitField.Flags.Speak)
    ) {
      await interaction.reply({
        content: "I don't have permission to speak in that channel.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Check if already in a call
    if (interaction.client.audio.isRealtimeCallActive(interaction.guild!.id)) {
      await interaction.reply({
        content: "A realtime call is already active in this server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Connect to voice channel first
    const { isNew } = interaction.client.audio.connectToChannel(voiceChannel);

    // Get options
    const voice = (interaction.options.getString("voice") as any) || "alloy";
    const instructions =
      interaction.options.getString("instructions") || undefined;

    // Start the realtime call
    const success = await interaction.client.audio.startRealtimeCall(
      interaction.guild!.id,
      { voice, instructions }
    );

    if (success) {
      await interaction.reply({
        content: `🎙️ Started realtime AI call in <#${
          voiceChannel.id
        }> with voice "${voice}".${
          isNew ? "" : " (Already connected to voice channel)"
        }\n\n**Ready to chat!** Just speak naturally - the AI will respond with voice.`,
        flags: [MessageFlags.Ephemeral],
      });
    } else {
      await interaction.reply({
        content:
          "❌ Failed to start realtime call. Make sure `OPENAI_API_KEY` is set in environment variables.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};

export default command;
