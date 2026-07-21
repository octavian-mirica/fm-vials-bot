import dotenv from 'dotenv';
dotenv.config();

import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  TextChannel,
} from 'discord.js';
import {
  loadLeaderboardId,
  saveLeaderboardId,
  updateLeaderboard,
} from './leaderboard';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// const leaderboardChannelId = '1528763187997184062';
const leaderboardChannelId = '1529132076568416286';

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const channel = client.channels.cache.get(
    leaderboardChannelId,
  ) as TextChannel;
  if (!channel) {
    console.error('Leaderboard channel not found');
    return;
  }

  let messageId = loadLeaderboardId();

  if (messageId) {
    try {
      await channel.messages.fetch(messageId);
      console.log('Leaderboard message loaded.');
      return;
    } catch {
      console.warn('Stored leaderboard message not found. Creating a new one.');
    }
  }

  // Create a new leaderboard message
  const placeholder = '```\nLeaderboard initializing...\n```';
  const msg = await channel.send(placeholder);

  // Store the ID
  saveLeaderboardId(msg.id);

  console.log('New leaderboard message created and stored.');
});

client.on(Events.MessageCreate, (msg) => onMessageCreate(msg));

client.login(process.env.BOT_TOKEN);

async function onMessageCreate(msg: Message) {
  // Ignore bot messages
  if (msg.author.bot) return;

  if (msg.channel.id !== leaderboardChannelId) return;

  const channel = client.channels.cache.get(
    leaderboardChannelId,
  ) as TextChannel;
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
      warning.delete().catch(() => {});
    }, 4000);
  }

  // Valid number → get nickname or username
  const nickname =
    msg.member?.nickname || msg.author.globalName || msg.author.username;

  // Always delete the user message
  setTimeout(() => {
    msg.delete().catch(() => {});
  }, 5000);

  await updateLeaderboard(
    client,
    leaderboardChannelId,
    nickname,
    msg.author.id,
    value,
  );
}
