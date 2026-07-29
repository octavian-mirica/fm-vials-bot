import dotenv from 'dotenv';
dotenv.config();

import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  TextChannel,
} from 'discord.js';

import { LeaderboardService } from './leaderboard-service';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const leaderboardService = new LeaderboardService();

client.on(Events.MessageCreate, async (msg) => await onMessageCreate(msg));

client.login(process.env.BOT_TOKEN);

async function onMessageCreate(msg: Message) {
  await leaderboardService.updateLeaderboard(client, msg);
}
