"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const discord_js_1 = require("discord.js");
const leaderboard_service_1 = require("./leaderboard-service");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
const leaderboardService = new leaderboard_service_1.LeaderboardService();
client.on(discord_js_1.Events.MessageCreate, (msg) => onMessageCreate(msg));
client.login(process.env.BOT_TOKEN);
async function onMessageCreate(msg) {
    await leaderboardService.updateLeaderboard(client, msg);
}
