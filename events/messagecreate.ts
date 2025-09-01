import type { Event } from "../types/main";

const event: Event = {
    name: 'messageCreate',
    once: false,
    async execute(message, client) {
        if (message.author.bot) return;
        if (message.content.startsWith('!hello')) {
            message.reply('Hello!');
        }
    }
};

export default event