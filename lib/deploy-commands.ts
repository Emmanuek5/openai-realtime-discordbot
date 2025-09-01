import { REST, Routes } from 'discord.js';
import type { Command } from '../types/main';
import type { Collection } from 'discord.js';

export async function deployCommands(commands: Collection<string, Command>, token: string, clientId: string) {
    const rest = new REST().setToken(token);
    const commandData = Array.from(commands.values()).map(command => command.data.toJSON());

    try {
        console.log(`Started refreshing ${commandData.length} application (/) commands.`);

        // Deploy commands globally
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commandData },
        );

        console.log(`Successfully reloaded ${commandData.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}
