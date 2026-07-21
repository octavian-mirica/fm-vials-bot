"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaderboard = updateLeaderboard;
async function updateLeaderboard(leaderboardMessageId, leaderboardChannelId, client, username, value) {
    const channel = client.channels.cache.get(leaderboardChannelId);
    if (!channel) {
        console.error('Leaderboard channel not found');
        return;
    }
    let entries = [];
    // Try to fetch existing leaderboard message
    if (leaderboardMessageId) {
        try {
            const msg = await channel.messages.fetch(leaderboardMessageId);
            const rawText = msg.content.replace(/```/g, '').trim();
            entries = parseLeaderboard(rawText);
        }
        catch {
            console.warn('Leaderboard message not found, creating new one.');
        }
    }
    // Update or insert user
    const existing = entries.find((e) => e.username === username);
    if (existing) {
        existing.value = value;
        existing.timestamp = Date.now();
    }
    else {
        entries.push({
            username,
            value,
            timestamp: Date.now(),
        });
    }
    // Build new leaderboard text
    const text = buildLeaderboard(entries);
    const wrapped = '```\n' + text + '\n```';
    // Update existing message
    if (leaderboardMessageId) {
        try {
            const msg = await channel.messages.fetch(leaderboardMessageId);
            await msg.edit(wrapped);
            return;
        }
        catch {
            console.warn('Failed to update leaderboard, creating new one.');
        }
    }
    // Create new message
    const newMsg = await channel.send(wrapped);
    leaderboardMessageId = newMsg.id;
}
function timeAgo(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)
        return 'just now';
    if (diffMin < 60)
        return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}
function pad(str, width) {
    return str.length >= width ? str : str + ' '.repeat(width - str.length);
}
function parseLeaderboard(text) {
    const lines = text.split('\n').map((l) => l.trim());
    const entries = [];
    for (const line of lines) {
        // Skip empty lines and total line
        if (!line || line.startsWith('Total'))
            continue;
        // Example line:
        // 1. Octavian                   | 5m ago | 150
        const match = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)$/);
        if (!match)
            continue;
        const [, username, ago, valueStr] = match;
        const value = parseInt(valueStr, 10);
        // Convert "5m ago" back into a timestamp
        const timestamp = convertAgoToTimestamp(ago);
        entries.push({ username: username.trim(), value, timestamp });
    }
    return entries;
}
function convertAgoToTimestamp(ago) {
    const now = Date.now();
    if (ago === 'just now')
        return now;
    const match = ago.match(/^(\d+)([mhd]) ago$/);
    if (!match)
        return now;
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'm')
        return now - amount * 60000;
    if (unit === 'h')
        return now - amount * 3600000;
    if (unit === 'd')
        return now - amount * 86400000;
    return now;
}
function buildLeaderboard(entries) {
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    let totalValue = 0;
    const lines = [];
    sorted.forEach((entry, index) => {
        totalValue += entry.value;
        const rank = index + 1;
        const name = pad(entry.username, 25);
        const ago = pad(timeAgo(entry.timestamp), 8);
        lines.push(`${rank}. ${name} | ${ago} | ${entry.value}`);
    });
    lines.push('');
    lines.push(`Total${' '.repeat(28)}| ${sorted.length} players | ${totalValue}`);
    return lines.join('\n');
}
