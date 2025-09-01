  import fs from "node:fs";
import path from "node:path";
import { Collection } from "discord.js";

export async function loadCommands(dir: string, commands: Collection<string, any>) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load commands from subdirectories
      await loadCommands(filePath, commands);
    } else if (file.endsWith(".ts")) {
      // Load the command file
      const command = await import(filePath);
      // Set a new item in the Collection with the key as the command name and the value as the exported module
      if ("data" in command.default && "execute" in command.default) {
        commands.set(command.default.data.name, command.default);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }
}

export async function loadInteractions(dir: string, interactions: Collection<string, any>) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load commands from subdirectories
      await loadInteractions(filePath, interactions);
    } else if (file.endsWith(".ts")) {
      // Load the interaction file
      const interaction = await import(filePath);
      // Set a new item in the Collection with the key as the customId and the value as the exported module
      if (
        "customId" in interaction.default ||
        ("commandName" in interaction.default && "execute" in interaction.default)
      ) {
        if (!interaction.default.customId) {
          interaction.default.customId = interaction.default.commandName;
        }
        interactions.set(interaction.default.customId, interaction.default);
      } else {
        console.log(
          `[WARNING] The interaction at ${filePath} is missing required properties.`
        );
      }
    }
  }
}

export async function loadEvents(dir: string, client: any) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load events from subdirectories
      await loadEvents(filePath, client);
    } else if (file.endsWith(".ts")) {
      // Load the event file
      const event = await import(filePath);
      if ("name" in event.default && "execute" in event.default) {
        if (event.default.once) {
          client.once(event.default.name, (...args: any) => event.default.execute(...args, client));
        } else {
          client.on(event.default.name, (...args: any) => event.default.execute(...args, client));
        }
      } else {
        console.log(
          `[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`
        );
      }
    }
  }
}