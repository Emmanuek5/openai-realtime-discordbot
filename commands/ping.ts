import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/main";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "Pinging..." });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! 🏓\nLatency: ${latency}ms\nWebsocket: ${interaction.client.ws.ping}ms`
    );
  },
};

export default command;
