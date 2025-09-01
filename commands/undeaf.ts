import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types/main";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("undeaf")
    .setDescription("Undeafen the bot in the voice channel."),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const ok = await interaction.client.audio.undeaf(interaction.guild!);
    await interaction.reply({
      content: ok ? "Undeafened." : "I'm not in a voice channel.",
      flags: [MessageFlags.Ephemeral],
    });
  },
};

export default command;
