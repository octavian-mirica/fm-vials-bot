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
    console.error('Leaderboard message not found, cannot update.');
    return;
  }

  // Extract raw text (remove ``` wrapper)
  const rawText = msg.content.replace(/```/g, '').trim();

  // Parse existing leaderboard
  let entries = parseLeaderboard(rawText);

  // Update or insert user
  const existing = entries.find((e) => e.username === username);
  if (existing) {
    existing.value = value;
    existing.timestamp = Date.now();
  } else {
    entries.push({
      username,
      value,
      timestamp: Date.now(),
    });
  }

  // Build new leaderboard text
  const newText = buildLeaderboard(entries);
  const wrapped = '```\n' + newText + '\n```';

  // Edit the SAME message
  await msg.edit(wrapped);
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
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const entries: LeaderboardEntry[] = [];

  for (const line of lines) {
    // Skip total line
    if (line.startsWith('Total')) continue;

    // Try to match the leaderboard format
    // Example:
    // 1. Octavian                   | 5m ago | 150
    const match = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)$/);

    if (!match) {
      // Line does NOT match leaderboard format → ignore it
      continue;
    }

    const [, username, ago, valueStr] = match;
    const value = parseInt(valueStr, 10);
    const timestamp = convertAgoToTimestamp(ago);

    entries.push({
      username: username.trim(),
      value,
      timestamp,
    });
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
    const rankLabel = `${rank}.`; // no medals

    const name = pad(entry.username, 25);
    const ago = pad(timeAgo(entry.timestamp), 8);

    lines.push(`${rankLabel} ${name} | ${ago} | ${entry.value}`);
  });

  // If no entries, return empty total
  if (lines.length === 0) {
    const totalName = pad('Total', 25);
    const totalAgo = pad('0 players', 8);
    return `${totalName} | ${totalAgo} | 0`;
  }

  // Measure name column start (after "X. ")
  const sample = lines[0];
  const dotIndex = sample.indexOf('.');
  const nameColumnStart = dotIndex + 2; // ". " → 2 chars

  // Measure value column start (second pipe + 2 spaces)
  const secondPipeIndex = sample.indexOf('|', sample.indexOf('|') + 1);
  const valueColumnStart = secondPipeIndex + 2;

  // Build TOTAL row with same alignment
  const totalName = pad('Total', 25);
  const totalAgo = pad(`${sorted.length} players`, 8);

  let totalRow = '';

  // Prefix spaces to match rank prefix width
  totalRow += ' '.repeat(nameColumnStart);

  // Add padded name + middle column
  totalRow += totalName + ' | ' + totalAgo + ' | ';

  // Align value column
  const currentLength = totalRow.length;
  if (currentLength < valueColumnStart) {
    totalRow += ' '.repeat(valueColumnStart - currentLength);
  }

  totalRow += totalValue;

  lines.push('');
  lines.push(totalRow);

  return lines.join('\n');
}
