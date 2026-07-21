"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const discord_js_1 = require("discord.js");
const leaderboard_1 = require("./leaderboard");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
// const leaderboardChannelId = '1528763187997184062';
const leaderboardChannelId = '1529132076568416286';
client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    const channel = client.channels.cache.get(leaderboardChannelId);
    if (!channel) {
        console.error('Leaderboard channel not found');
        return;
    }
    let messageId = (0, leaderboard_1.loadLeaderboardId)();
    if (messageId) {
        try {
            await channel.messages.fetch(messageId);
            console.log('Leaderboard message loaded.');
            return;
        }
        catch {
            console.warn('Stored leaderboard message not found. Creating a new one.');
        }
    }
    // Create a new leaderboard message
    const placeholder = '```\nLeaderboard initializing...\n```';
    const msg = await channel.send(placeholder);
    // Store the ID
    (0, leaderboard_1.saveLeaderboardId)(msg.id);
    console.log('New leaderboard message created and stored.');
});
client.on('messageCreate', (msg) => onMessageCreate(msg));
client.login(process.env.BOT_TOKEN);
async function onMessageCreate(msg) {
    // Ignore bot messages
    if (msg.author.bot)
        return;
    const channel = client.channels.cache.get(leaderboardChannelId);
    if (!channel) {
        console.error('Leaderboard channel not found');
        return;
    }
    // Try to parse integer
    const value = parseInt(msg.content.trim(), 10);
    if (isNaN(value) || value < 0) {
        // Not a number → send warning
        const warning = await msg.reply({
            content: '⚠️ Please enter a valid number (> 0).',
        });
        // Delete warning after 5 seconds
        setTimeout(() => {
            warning.delete().catch(() => { });
        }, 4000);
    }
    // Valid number → get nickname or username
    const nickname = msg.member?.nickname || msg.author.globalName || msg.author.username;
    // Always delete the user message
    setTimeout(() => {
        msg.delete().catch(() => { });
    }, 5000);
    await (0, leaderboard_1.updateLeaderboard)(client, leaderboardChannelId, nickname, value);
}
