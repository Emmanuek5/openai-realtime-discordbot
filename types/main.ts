import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Interaction {
  customId: string;
  interceptors: "startsWith" | "endsWith" | "includes";
  isAutoComplete: boolean;
  execute: (interaction: any) => Promise<void>;
}

export interface Event {
  name: string;
  once?: boolean;
  execute: (...args: any) => Promise<void>;
}
