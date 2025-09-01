import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ClientPresence,
  ActivityType,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  Colors,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { loadCommands, loadInteractions, loadEvents } from "./lib/functions";
import { AudioManager } from "./lib/audio-manager";

import type { Command } from "./types/main";
import { deployCommands } from "./lib/deploy-commands";

// Extend the Client type to include our collections
declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
    audio: AudioManager;
  }
}

const client = new Client({
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
  ],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMembers,
  ],
});

// Initialize collections
client.commands = new Collection<string, Command>();
client.audio = new AudioManager();
const interactions = new Collection<string, any>();
const commandsPath = path.join(__dirname, "./commands");
const interactionPath = path.join(__dirname, "./interactions");
const eventsPath = path.join(__dirname, "./events");

// Load commands, interactions, and events
await loadCommands(commandsPath, client.commands);
await loadInteractions(interactionPath, interactions);
await loadEvents(eventsPath, client);

client.on("interactionCreate", async (interaction: any) => {
  if (interaction.isAutocomplete()) {
    const commandName = interaction.commandName;

    const autocompleteHandler = interactions.get(commandName);

    if (autocompleteHandler) {
      try {
        await autocompleteHandler.execute(interaction);
      } catch (error: any) {
        console.log(error);
        const channel = client.channels.cache.get(process.env.ERROR_CHANNEL!);

        // Include the error stack
        const embed = new EmbedBuilder();
        embed.setTitle(
          `There was an error while executing ${commandName} autocomplete!`
        );
        embed
          .setDescription(
            `${error.name}: ${error.message.slice(0, 4000)}\n\n${error.stack}`
          )
          .setColor(Colors.Red)
          .setAuthor({ name: "Error" })
          .setTimestamp()
          .setFooter({ text: interaction.guild?.name! });

        if (channel?.isSendable()) {
          channel.send({ embeds: [embed] });
        }
      }
      return;
    }
  }

  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    let interactionHandler = interactions.get(interaction.customId);
    if (!interactionHandler) {
      // Look for an interceptor if an exact match is not found
      for (const [key, handler] of interactions) {
        switch (handler.interceptors) {
          case "startsWith":
            if (interaction.customId.startsWith(key)) {
              interactionHandler = handler;
            }
            break;
          case "endsWith":
            if (interaction.customId.endsWith(key)) {
              interactionHandler = handler;
            }
            break;
          case "includes":
            if (interaction.customId.includes(key)) {
              interactionHandler = handler;
            }
            break;
          default:
            break;
        }
      }
    }

    if (!interactionHandler) {
      console.error(
        `No interaction matching ${interaction.customId} was found.`
      );
      return;
    }

    try {
      await interactionHandler.execute(interaction);
    } catch (error: any) {
      console.log(error);
      const channel = client.channels.cache.get(process.env.ERROR_CHANNEL!);

      // Include the error stack
      const embed = new EmbedBuilder();
      embed.setTitle(
        `There was an error while executing ${interaction.customId} interaction!`
      );
      embed
        .setDescription(`${error.name}: ${error.message}\n\n${error.stack}`)
        .setColor(Colors.Red)
        .setAuthor({ name: "Error" })
        .setTimestamp()
        .setFooter({ text: interaction.guild?.name! });

      if (channel?.isSendable()) {
        channel.send({ embeds: [embed] });
      }
    }

    return;
  } else {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error: any) {
      console.log(error);
      const channel = client.channels.cache.get(process.env.ERROR_CHANNEL!);

      // Include the error stack
      const embed = new EmbedBuilder();
      embed.setTitle(
        `There was an error while executing ${interaction.command} command!`
      );
      embed
        .setDescription(`${error.name}: ${error.message}\n\n${error.stack}`)
        .setColor(Colors.Red)
        .setAuthor({ name: "Error" })
        .setTimestamp()
        .setFooter({ text: interaction.guild?.name! });

      if (channel?.isSendable()) {
        channel.send({ embeds: [embed] });
      }
    }
  }
});

client.on(Events.ClientReady, () => {
  deployCommands(client.commands, process.env.TOKEN!, client.user?.id!);
});

client.login(process.env.TOKEN);
