import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Message } from 'discord.js';
import { updateLeaderboard } from './leaderboard';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const leaderboardMessageId = '1529118070000451614';
const leaderboardChannelId = '1528763187997184062';

client.on('messageCreate', (msg) => onMessageCreate(msg));

client.login(process.env.BOT_TOKEN);

async function onMessageCreate(msg: Message) {
  // Ignore bot messages
  if (msg.author.bot) return;

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
      warning.delete().catch(() => {});
    }, 5000);

    // Valid number → get nickname or username
    const nickname =
      msg.member?.nickname || msg.author.globalName || msg.author.username;

    await updateLeaderboard(
      client,
      leaderboardChannelId,
      leaderboardMessageId,
      nickname,
      value,
    );

    msg.delete().catch(() => {});
  }
}
