import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  MessageFlags,
} from "discord.js";
import type { Command } from "../types/main";
import { getVoiceConnection } from "@discordjs/voice";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("call")
    .setDescription("Join your current voice channel."),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const member = await interaction!.guild!.members.fetch(interaction.user.id);
    const voiceChannel = member.voice.channel;

    if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
      await interaction.reply({
        content: "You must be connected to a voice channel.",
        ephemeral: true,
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
        ephemeral: true,
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
        ephemeral: true,
      });
      return;
    }

    const existing = getVoiceConnection(interaction.guild!.id);
    if (existing) {
      // If already connected elsewhere, just respond
      await interaction.reply({
        content: `I'm already connected.`,
        ephemeral: true,
      });
      return;
    }

    const { isNew } = interaction.client.audio.connectToChannel(voiceChannel);

    await interaction.reply({
      content: isNew
        ? `Joined <#${voiceChannel.id}>.`
        : `Already connected to <#${voiceChannel.id}>.`,
      flags: [MessageFlags.Ephemeral],
    });
  },
};

export default command;
