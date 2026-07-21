import { Client, TextChannel } from 'discord.js';

export async function updateLeaderboard(
  client: Client,
  leaderboardChannelId: string,
  leaderboardMessageId: string,
  username: string,
  value: number,
): Promise<void> {
  const channel = client.channels.cache.get(
    leaderboardChannelId,
  ) as TextChannel;
  if (!channel) {
    console.error('Leaderboard channel not found');
    return;
  }

  // Fetch the existing leaderboard message
  let msg;
  try {
    msg = await channel.messages.fetch(leaderboardMessageId);
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
  const lines = text.split('\n').map((l) => l.trim());
  const entries: LeaderboardEntry[] = [];

  for (const line of lines) {
    if (!line || line.startsWith('Total')) continue;

    // 1. Octavian                   | 5m ago | 150
    const match = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)$/);
    if (!match) continue;

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

  sorted.forEach((entry, index) => {
    totalValue += entry.value;

    const rank = index + 1;
    const name = pad(entry.username, 25);
    const ago = pad(timeAgo(entry.timestamp), 8);

    lines.push(`${rank}. ${name} | ${ago} | ${entry.value}`);
  });

  lines.push('');
  lines.push(
    `Total${' '.repeat(28)}| ${sorted.length} players | ${totalValue}`,
  );

  return lines.join('\n');
}
