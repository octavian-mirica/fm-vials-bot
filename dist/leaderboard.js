"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLeaderboardId = loadLeaderboardId;
exports.saveLeaderboardId = saveLeaderboardId;
exports.updateLeaderboard = updateLeaderboard;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Path inside dist/
const dataDir = path_1.default.join(__dirname, 'data');
const filePath = path_1.default.join(dataDir, 'leaderboard.json');
// Ensure data folder exists
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Ensure file exists
if (!fs_1.default.existsSync(filePath)) {
    fs_1.default.writeFileSync(filePath, JSON.stringify({ messageId: null }, null, 2));
}
function loadLeaderboardId() {
    try {
        const raw = fs_1.default.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return data.messageId || null;
    }
    catch {
        return null;
    }
}
function saveLeaderboardId(id) {
    const data = { messageId: id };
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
async function updateLeaderboard(client, leaderboardChannelId, username, value) {
    if (isNaN(value) || value < 0) {
        // Ignore invalid input
        return;
    }
    const channel = client.channels.cache.get(leaderboardChannelId);
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
    }
    catch {
        return;
    }
    const rawText = msg.content.replace(/```/g, '').trim();
    let entries = parseLeaderboard(rawText);
    const existing = entries.find((e) => e.username === username);
    if (existing) {
        existing.value = value;
        existing.timestamp = Date.now();
    }
    else {
        entries.push({ username, value, timestamp: Date.now() });
    }
    await msg.edit({
        content: null,
        embeds: [buildLeaderboardEmbed(entries)],
    });
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
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const entries = [];
    for (const line of lines) {
        // Skip total row
        if (line.startsWith('Total'))
            continue;
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
        const oldDiscordFormat = line.match(/^\d+\.\s+(.+?)\s+\|\s+<t:(\d+):R>\s+\|\s+(\d+)/);
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
        const oldHumanFormat = line.match(/^\d+\.\s+(.+?)\s+\|\s+(.+?)\s+\|\s+(\d+)/);
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
const USER_WIDTH = 32; // index + username
const VALUE_WIDTH = 10; // score
function buildLeaderboard(entries) {
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    let totalValue = 0;
    const lines = [];
    sorted.forEach((entry, index) => {
        totalValue += entry.value;
        const rank = `${index + 1}.`;
        let userCol = `${rank} ${entry.username}`;
        // truncate if too long
        if (userCol.length > USER_WIDTH) {
            userCol = userCol.slice(0, USER_WIDTH);
        }
        userCol = userCol.padEnd(USER_WIDTH, ' ');
        const valueCol = String(entry.value).padStart(VALUE_WIDTH, ' ');
        const discordTs = Math.floor(entry.timestamp / 1000);
        const ago = `<t:${discordTs}:R>`;
        lines.push(`${userCol} ${valueCol}   ${ago}`);
    });
    // total row
    let totalUser = 'Total';
    if (totalUser.length > USER_WIDTH) {
        totalUser = totalUser.slice(0, USER_WIDTH);
    }
    totalUser = totalUser.padEnd(USER_WIDTH, ' ');
    const totalVal = String(totalValue).padStart(VALUE_WIDTH, ' ');
    const totalAgo = `${sorted.length} players`;
    lines.push('');
    lines.push(`${totalUser} ${totalVal}   ${totalAgo}`);
    return lines.join('\n');
}
function buildLeaderboardEmbed(entries) {
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const USER_WIDTH = 20;
    const VALUE_WIDTH = 6;
    let totalValue = 0;
    const rows = [];
    sorted.forEach((entry, index) => {
        totalValue += entry.value;
        const rank = `${index + 1}.`;
        let userCol = `${rank} ${entry.username}`;
        if (userCol.length > USER_WIDTH) {
            userCol = userCol.slice(0, USER_WIDTH);
        }
        userCol = userCol.padEnd(USER_WIDTH, ' ');
        const valueCol = String(entry.value).padStart(VALUE_WIDTH, ' ');
        const discordTs = Math.floor(entry.timestamp / 1000);
        const ago = `<t:${discordTs}:R>`;
        rows.push(`${userCol} ${valueCol}   ${ago}`);
    });
    rows.push('');
    rows.push(`Total`.padEnd(USER_WIDTH, ' ') +
        String(totalValue).padStart(VALUE_WIDTH, ' ') +
        `   ${sorted.length} players`);
    const description = rows.join('\n'); // NO CODE BLOCK
    return new discord_js_1.EmbedBuilder()
        .setColor(0x00aeef)
        .setTitle('Leaderboard')
        .setDescription(description);
}
