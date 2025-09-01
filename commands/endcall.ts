import { SlashCommandBuilder, MessageFlags } from "discord.js";
import type { Command } from "../types/main";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("endcall")
    .setDescription("End the current realtime AI voice call."),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Check if there's an active call
    if (!interaction.client.audio.isRealtimeCallActive(interaction.guild!.id)) {
      await interaction.reply({
        content: "No realtime call is currently active in this server.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    // Stop the realtime call
    const success = await interaction.client.audio.stopRealtimeCall(
      interaction.guild!.id
    );

    if (success) {
      await interaction.reply({
        content:
          "🔇 Ended realtime AI call. The bot is still connected to the voice channel.",
        flags: [MessageFlags.Ephemeral],
      });
    } else {
      await interaction.reply({
        content: "❌ Failed to end realtime call.",
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};

export default command;

