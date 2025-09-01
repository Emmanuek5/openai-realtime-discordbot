import type { Event } from "../types/main";
import { deployCommands } from "../lib/deploy-commands";

const event: Event = {
  name: "clientReady",
  async execute(client) {
    const botInvite = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=applications.commands%20bot`;
    console.log(`[${client.user.tag}] is online!`);
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(botInvite);
  },
};

export default event;
