# OpenAI Realtime Discord Bot

A powerful Discord bot that brings OpenAI's Realtime API voice capabilities to your Discord server. Have natural voice conversations with an AI assistant directly in Discord voice channels!

## 🎥 Demo Video

Check out the bot in action:

https://github.com/user-attachments/assets/example-video

_[Video shows the bot joining a voice channel and having a natural conversation using OpenAI's speech-to-speech technology]_

## ✨ Features

### 🎙️ **Realtime Voice Conversations**

- Natural speech-to-speech conversations using OpenAI's Realtime API
- Multiple AI voice options (Alloy, Echo, Fable, Onyx, Nova, Shimmer)
- Custom instructions for personalized AI behavior
- Intelligent noise filtering and voice detection

### 🎛️ **Voice Channel Management**

- Join/leave voice channels with simple commands
- Mute/unmute and deaf/undeaf controls
- Smart permission checking
- Automatic audio format conversion (24kHz mono → 48kHz stereo)

### 🧠 **Advanced AI Capabilities**

- Function calling support - AI can end calls naturally
- Self-muting capability - AI can pause speaking while continuing to listen
- Note-taking functionality - AI can save important conversation points
- Conversation memory and context awareness

### 🛡️ **Robust Error Handling**

- Comprehensive error logging and reporting
- Graceful fallbacks for API failures
- Permission validation and user feedback

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.1.20+)
- Discord Bot Token
- OpenAI API Key with Realtime API access
- Node.js 18+ (for compatibility)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/openai-realtime-discordbot.git
cd openai-realtime-discordbot
bun install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
TOKEN=your_discord_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
ERROR_CHANNEL=optional_error_channel_id
```

### 3. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token to your `.env` file
4. Enable these bot permissions:
   - `Send Messages`
   - `Use Slash Commands`
   - `Connect` (Voice)
   - `Speak` (Voice)
   - `Use Voice Activity`

### 4. Invite Bot to Server

Use this URL template (replace `YOUR_CLIENT_ID` with your bot's client ID):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3146752&scope=bot%20applications.commands
```

### 5. Run the Bot

```bash
bun start
```

The bot will automatically deploy slash commands when it starts up.

## 🎮 Commands

| Command      | Description                            | Options                                                      |
| ------------ | -------------------------------------- | ------------------------------------------------------------ |
| `/startcall` | Begin a realtime AI voice conversation | `voice` (AI voice type), `instructions` (custom AI behavior) |
| `/endcall`   | Stop the active realtime conversation  | None                                                         |
| `/call`      | Join your current voice channel        | None                                                         |
| `/ping`      | Check if the bot is responsive         | None                                                         |

### Voice Options

Choose from 6 different AI voices:

- **Alloy** (Default) - Balanced and clear
- **Echo** - Warm and friendly
- **Fable** - Expressive and dynamic
- **Onyx** - Deep and authoritative
- **Nova** - Bright and engaging
- **Shimmer** - Soft and gentle

## 💬 Usage Examples

### Basic Voice Chat

```
1. Join a voice channel
2. Run: /startcall
3. Start speaking naturally!
4. The AI will respond with voice
5. End with: /endcall (or just say "end the call")
```

### Custom AI Personality

```
/startcall voice:nova instructions:You are a helpful coding assistant. Be technical but friendly.
```

### Advanced Features

The AI can naturally:

- End calls when you ask ("please end the call")
- Take notes during conversations ("remember that we decided...")
- Temporarily mute itself ("hold on, let me think...")

## 🏗️ Architecture

### Core Components

- **AudioManager** (`lib/audio-manager.ts`) - Handles all voice connections and audio processing
- **Commands** (`commands/`) - Slash command implementations
- **Events** (`events/`) - Discord event handlers
- **Types** (`types/`) - TypeScript type definitions

### Audio Flow

1. **User speaks** → Discord voice input → Opus decoding → PCM16
2. **PCM16** → Base64 encoding → OpenAI Realtime API
3. **AI response** → PCM16 audio → Format conversion → Discord voice output

### Key Technologies

- **Discord.js** - Discord API wrapper
- **@discordjs/voice** - Voice connection management
- **@openai/agents** - OpenAI Realtime API integration
- **Prism Media** - Audio processing and format conversion
- **Bun** - Fast JavaScript runtime

## 🔧 Configuration

### Environment Variables

| Variable         | Required | Description                         |
| ---------------- | -------- | ----------------------------------- |
| `TOKEN`          | ✅       | Discord bot token                   |
| `OPENAI_API_KEY` | ✅       | OpenAI API key with Realtime access |
| `ERROR_CHANNEL`  | ❌       | Discord channel ID for error logs   |

### Audio Settings

The bot automatically handles audio format conversion:

- **Input**: Discord Opus → PCM16 24kHz mono
- **Output**: OpenAI PCM16 → Discord 48kHz stereo

Voice detection settings are optimized for Discord:

- Detection threshold: 0.9 (high noise filtering)
- Prefix padding: 300ms
- Silence duration: 1200ms

## 📝 Development

### Project Structure

```
openai-realtime-discordbot/
├── commands/           # Slash command implementations
├── events/            # Discord event handlers
├── lib/               # Core functionality
│   ├── audio-manager.ts   # Voice/audio management
│   ├── functions.ts       # Utility functions
│   └── deploy-commands.ts # Command deployment
├── types/             # TypeScript definitions
├── example/           # Demo materials
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript config
└── Changelog.md       # Feature history
```

### Scripts

```bash
bun start           # Start the bot
bun run delete      # Delete deployed commands (cleanup)
```

### Adding New Commands

1. Create a new file in `commands/`
2. Export a command object with `data` and `execute` properties
3. The bot automatically loads and deploys new commands

### Audio Processing

The `AudioManager` class handles:

- Voice connection lifecycle
- Audio format conversion
- OpenAI Realtime API integration
- Error recovery and cleanup

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands:**

- Check bot permissions in Discord
- Verify the bot token in `.env`
- Ensure slash commands are deployed

**Voice not working:**

- Confirm OpenAI API key has Realtime access
- Check voice channel permissions
- Verify audio dependencies are installed

**Audio quality issues:**

- Ensure stable internet connection
- Check Discord voice region settings
- Verify microphone input quality

### Debug Logs

The bot provides detailed console logging:

- 🔧 Setup and configuration
- 🎙️ Voice events
- 🤖 AI interactions
- ❌ Errors and warnings

## 📄 License

This project is open source. Please check the repository for license details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 🔗 Links

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord Developer Portal](https://discord.com/developers/applications)

---

**Note**: This bot requires OpenAI API access to the Realtime API (currently in beta). Make sure your OpenAI account has the necessary permissions and credits.
