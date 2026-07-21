import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Message } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('ready', () => {
  console.log(`Logged in as ${client?.user?.tag}`);
});

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

    return;
  }

  // Valid number → get nickname or username
  const nickname = msg.member?.nickname || msg.author.username;
  console.log(msg);

  console.log(`User: ${nickname}, Value: ${value}`);

  // Later: update leaderboard here
}
