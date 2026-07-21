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
async function updateLeaderboard(client, leaderboardChannelId, username, userId, value) {
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
    const embed = msg.embeds[0];
    const text = embed?.description ?? '';
    let entries = parseLeaderboard(text);
    entries = mergeNewUser(entries, msg.author.id, username, value, Date.now());
    const existing = entries.find((e) => e.username === username);
    if (existing) {
        existing.value = value;
        existing.timestamp = Date.now();
    }
    else {
        entries.push({ username, value, userId, timestamp: Date.now() });
    }
    await msg.edit({
        content: null,
        embeds: [buildLeaderboardEmbed(entries)],
    });
}
function parseLeaderboard(text) {
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    const entries = [];
    for (const line of lines) {
        if (line.startsWith('Total'))
            continue;
        // Match ONLY the new embed format:
        // `1. Fitz ... 2060 | 123456789012345678`   <t:...:R>
        const match = line.match(/^`(.+?)`\s+<t:(\d+):R>/);
        if (!match)
            continue;
        const inside = match[1];
        const tsSeconds = parseInt(match[2], 10);
        // Extract rank, username, value, userId
        const parts = inside.match(/^(\d+)\.\s+(.*?)\s+(\d+)\s+\|\s+(\d+)$/);
        if (!parts)
            continue;
        const username = parts[2].trim();
        const value = parseInt(parts[3], 10);
        const userId = parts[4].trim();
        entries.push({
            username,
            value,
            userId,
            timestamp: tsSeconds * 1000,
        });
    }
    return entries;
}
function buildLeaderboardEmbed(entries) {
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const USER_WIDTH = 40;
    const VALUE_WIDTH = 12;
    let totalValue = 0;
    const rows = [];
    for (let i = 0; i < sorted.length; i++) {
        const entry = sorted[i];
        totalValue += entry.value;
        const rank = `${i + 1}.`;
        let userCol = `${rank} ${entry.username}`;
        if (userCol.length > USER_WIDTH) {
            userCol = userCol.slice(0, USER_WIDTH);
        }
        userCol = userCol.padEnd(USER_WIDTH, ' ');
        const valueCol = String(entry.value).padStart(VALUE_WIDTH, ' ');
        const ts = Math.floor(entry.timestamp / 1000);
        const ago = `<t:${ts}:R>`;
        // Hidden userId inside the inline code block
        rows.push(`\`${userCol} ${valueCol} | ${entry.userId}\`   ${ago}`);
    }
    const totalUser = 'Total'.padEnd(USER_WIDTH, ' ');
    const totalVal = String(totalValue).padStart(VALUE_WIDTH, ' ');
    rows.push('');
    rows.push(`\`${totalUser} ${totalVal} | total\`   ${sorted.length} players`);
    return new discord_js_1.EmbedBuilder()
        .setColor(0x00aeef)
        .setTitle('Leaderboard')
        .setDescription(rows.join('\n'));
}
function mergeNewUser(entries, newUserId, newUsername, newValue, newTimestamp) {
    // 1. Check if any existing username starts with the new username
    const duplicates = entries.filter((e) => e.username.startsWith(newUsername));
    // 2. Remove duplicates
    for (const dup of duplicates) {
        const index = entries.indexOf(dup);
        if (index !== -1)
            entries.splice(index, 1);
    }
    // 3. Add new entry using userId
    entries.push({
        username: newUsername,
        value: newValue,
        userId: newUserId,
        timestamp: newTimestamp,
    });
    return entries;
}
