## Changelog

### Latest Updates

- **Comprehensive README**: Created detailed documentation with setup instructions, feature overview, architecture details, and troubleshooting guide.
- **Example Video Integration**: Added demo video section to showcase bot capabilities in README.
- **Enhanced Documentation**: Improved project structure documentation, usage examples, and development guidelines.

### Added

- /call command: Joins the user's current voice channel.
- /mute, /unmute, /deaf, /undeaf commands to control bot voice state.
- /startcall command: Begin realtime AI voice conversations using OpenAI's speech-to-speech models.
- /endcall command: Stop active realtime AI voice calls.
- ~~Audio logging: Automatically saves user input and AI responses as numbered WAV files (user_001.wav, model_001.wav, etc.).~~ **Removed for performance**
- Discord audio playback: Fixed audio format conversion from OpenAI (24kHz mono) to Discord (48kHz stereo) for proper voice output.

### Dependencies

- Added @discordjs/voice to enable voice connections.
- Added @openai/agents for realtime speech-to-speech AI conversations.
- Added wav package for audio file logging and @types/wav for TypeScript support.

### Internal

- Introduced `AudioManager` for managing guild voice connections and audio players.
- Added `AudioManager.mute/unmute/deaf/undeaf` helpers.
- Integrated OpenAI Realtime API with Discord voice channels via WebSocket transport.
- Implemented PCM16 audio streaming between Discord and OpenAI.
- Added comprehensive logging for debugging voice flow.
- Implemented Discord voice input capture with Opus decoding.
- Fixed Realtime API integration to follow proper session lifecycle (session.update, turn detection, etc.)
- Updated audio input to use `input_audio_buffer.append` with base64 encoding as per API specification.
- Fixed WAV file writing with proper async handling to prevent ENOENT errors.
- Redesigned audio playback system with fresh streams per response to fix continuous conversation issues.
- Enhanced `/endcall` command with proper cleanup of OpenAI sessions, audio streams, and event listeners.
- Added function calling support with `end_call` tool - AI can now end calls when users request it naturally in conversation.
- Improved voice detection settings: Increased threshold to 0.9, added 300ms prefix padding, and 1200ms silence duration for excellent noise filtering.
- Removed WAV file logging: Eliminated automatic audio file saving for better performance and reduced disk usage.
- Added AI speaking detection: Bot now ignores user voice input while AI is actively speaking to prevent audio feedback and interruptions.
- Added `mute_self` tool: AI can temporarily mute itself (stop speaking) while continuing to listen, useful for thinking or letting users speak uninterrupted.
- Added `take_notes` tool: AI can save important conversation points, decisions, and action items to both memory and JSON files for later reference.
- Increased Discord voice detection threshold: Extended silence duration from 500ms to 1500ms to reduce noise sensitivity on the user input side.
