import { Client, TextChannel } from 'discord.js';

import fs from 'fs';
import path from 'path';

// Path inside dist/
const dataDir = path.join(__dirname, 'data');
const filePath = path.join(dataDir, 'leaderboard.json');

// Ensure data folder exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure file exists
if (!fs.existsSync(filePath)) {
  fs.writeFileSync(filePath, JSON.stringify({ messageId: null }, null, 2));
}

export function loadLeaderboardId(): string | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return data.messageId || null;
  } catch {
    return null;
  }
}

export function saveLeaderboardId(id: string) {
  const data = { messageId: id };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export async function updateLeaderboard(
  client: Client,
  leaderboardChannelId: string,
  username: string,
  value: number,
): Promise<void> {
  if (isNaN(value) || value < 0) {
    // Ignore invalid input
    return;
  }

  const channel = client.channels.cache.get(
    leaderboardChannelId,
  ) as TextChannel;
  if (!channel) {
    console.error('Leaderboard channel not found');
    return;
  }

  // Fetch the existing leaderboard message
  const messageId = loadLeaderboardId();
  if (!messageId) {
    console.error('Leaderboard message ID missing.');
    return;
  }

  let msg;
  try {
    msg = await channel.messages.fetch(messageId);
  } catch {
    return;
  }

  const rawText = msg.content.replace(/```/g, '').trim();
  let entries = parseLeaderboard(rawText);

  const existing = entries.find((e) => e.username === username);
  if (existing) {
    existing.value = value;
    existing.timestamp = Date.now();
  } else {
    entries.push({ username, value, timestamp: Date.now() });
  }

  const newText = buildLeaderboard(entries);

  await msg.edit(newText);
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function pad(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

interface LeaderboardEntry {
  username: string;
  value: number;
  timestamp: number;
}

function parseLeaderboard(text: string): LeaderboardEntry[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  const entries: LeaderboardEntry[] = [];

  for (const line of lines) {
    // Skip total row
    if (line.startsWith('Total')) continue;

    //
    // 1️⃣ NEW FORMAT (no separators, fixed width)
    // Example:
    // 1. Fitz                 2060      <t:1721586000:R>
    //
    const newFormat = line.match(/^(\d+)\.\s+(.+?)\s+(\d+)\s+<t:(\d+):R>/);
    if (newFormat) {
      const username = newFormat[2].trim();
      const value = parseInt(newFormat[3], 10);
      const tsSeconds = parseInt(newFormat[4], 10);

      entries.push({
        username,
        value,
        timestamp: tsSeconds * 1000,
      });
      continue;
    }

    //
    // 2️⃣ OLD FORMAT (Discord timestamp inside separators)
    // Example:
    // 1. Fitz | <t:1721586000:R> | 2060
    //
    const oldDiscordFormat = line.match(
      /^\d+\.\s+(.+?)\s+\|\s+<t:(\d+):R>\s+\|\s+(\d+)/,
    );
    if (oldDiscordFormat) {
      const username = oldDiscordFormat[1].trim();
      const tsSeconds = parseInt(oldDiscordFormat[2], 10);
      const value = parseInt(oldDiscordFormat[3], 10);

      entries.push({
        username,
        value,
        timestamp: tsSeconds * 1000,
      });
      continue;
    }

    //
    // 3️⃣ OLD FORMAT (human timeAgo)
    // Example:
    // 1. Fitz | 5m ago | 2060
    //
    const oldHumanFormat = line.match(
      /^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)/,
    );
    if (oldHumanFormat) {
      const username = oldHumanFormat[1].trim();
      const agoString = oldHumanFormat[2].trim();
      const value = parseInt(oldHumanFormat[3], 10);

      const timestamp = convertAgoToTimestamp(agoString);

      entries.push({
        username,
        value,
        timestamp,
      });
      continue;
    }
  }

  return entries;
}

function convertAgoToTimestamp(ago: string): number {
  const now = Date.now();

  if (ago === 'just now') return now;

  const match = ago.match(/^(\d+)([mhd]) ago$/);
  if (!match) return now;

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 'm') return now - amount * 60000;
  if (unit === 'h') return now - amount * 3600000;
  if (unit === 'd') return now - amount * 86400000;

  return now;
}

function buildLeaderboard(entries: LeaderboardEntry[]): string {
  const sorted = [...entries].sort((a, b) => b.value - a.value);

  let totalValue = 0;
  const lines: string[] = [];

  const USER_WIDTH = 26; // index + username padded
  const VALUE_WIDTH = 6; // score padded

  sorted.forEach((entry, index) => {
    totalValue += entry.value;

    const rank = `${index + 1}.`;
    const user = `${rank} ${entry.username}`.padEnd(USER_WIDTH, ' ');
    const value = String(entry.value).padEnd(VALUE_WIDTH, ' ');

    const discordTs = Math.floor(entry.timestamp / 1000);
    const ago = `<t:${discordTs}:R>`;

    lines.push(`${user}${value}   ${ago}`);
  });

  // Total row
  const totalUser = 'Total'.padEnd(USER_WIDTH, ' ');
  const totalVal = String(totalValue).padEnd(VALUE_WIDTH, ' ');
  const totalAgo = `${sorted.length} players`;

  lines.push('');
  lines.push(`${totalUser}${totalVal}   ${totalAgo}`);

  return lines.join('\n');
}
