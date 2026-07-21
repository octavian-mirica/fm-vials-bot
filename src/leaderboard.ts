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
    // New format: <t:TIMESTAMP:R>
    const newFormat = line.match(
      /^\d+\.\s+(.+?)\s+\|\s+<t:(\d+):R>\s+\|\s+(\d+)/,
    );
    if (newFormat) {
      const username = newFormat[1].trim();
      const tsSeconds = parseInt(newFormat[2], 10);
      const value = parseInt(newFormat[3], 10);

      entries.push({
        username,
        value,
        timestamp: tsSeconds * 1000,
      });
      continue;
    }

    // Old format: "5m ago", "just now", etc.
    const oldFormat = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)/);
    if (oldFormat) {
      const username = oldFormat[1].trim();
      const agoString = oldFormat[2].trim();
      const value = parseInt(oldFormat[3], 10);

      const timestamp = convertAgoToTimestamp(agoString);

      entries.push({
        username,
        value,
        timestamp,
      });
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

  // Build player rows
  sorted.forEach((entry, index) => {
    totalValue += entry.value;

    const rank = index + 1;
    const rankLabel = `${rank}.`;

    const name = pad(entry.username, 25);

    // Discord relative timestamp
    const discordTs = Math.floor(entry.timestamp / 1000);
    const ago = `<t:${discordTs}:R>`;

    lines.push(`${rankLabel} ${name} | ${ago} | ${entry.value}`);
  });

  if (lines.length === 0) {
    return `Total                     | 0 players | 0`;
  }

  // Measure name column start (after "X. ")
  const sample = lines[0];
  const dotIndex = sample.indexOf('.');
  const nameColumnStart = dotIndex + 2;

  // Measure value column start (second pipe + 2 spaces)
  const secondPipeIndex = sample.indexOf('|', sample.indexOf('|') + 1);
  const valueColumnStart = secondPipeIndex + 2;

  // Build TOTAL row
  const totalName = pad('Total', 25);
  const totalAgo = pad(`${sorted.length} players`, 8);

  let totalRow = '';

  // Prefix spaces to match rank prefix width
  totalRow += ' '.repeat(nameColumnStart);

  totalRow += totalName + ' | ' + totalAgo + ' | ';

  const currentLength = totalRow.length;
  if (currentLength < valueColumnStart) {
    totalRow += ' '.repeat(valueColumnStart - currentLength);
  }

  totalRow += totalValue;

  lines.push('');
  lines.push(totalRow);

  return lines.join('\n');
}
