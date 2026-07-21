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
const leaderboardMessageId = '1528767244191141949';
const leaderboardChannelId = '1528763187997184062';
client.on('messageCreate', (msg) => onMessageCreate(msg));
client.login(process.env.BOT_TOKEN);
async function onMessageCreate(msg) {
    // Ignore bot messages
    if (msg.author.bot)
        return;
    // Only allow one channel
    // if (msg.channel.id !== ALLOWED_CHANNEL) return;
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
    await (0, leaderboard_1.updateLeaderboard)(client, leaderboardChannelId, leaderboardMessageId, nickname, value);
}
