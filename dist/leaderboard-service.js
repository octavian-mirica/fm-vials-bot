"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class LeaderboardService {
    data = { allowedChannels: {}, leaderboards: {} };
    saveTimeout;
    // Path inside dist/
    dataDir = path_1.default.join(__dirname, 'data');
    filePath = path_1.default.join(this.dataDir, 'leaderboards.json');
    filePathTemp = path_1.default.join(this.dataDir, 'leaderboards.tmp.json');
    constructor() {
        this.loadData();
    }
    loadData() {
        this.ensureDataFolderExists();
        this.data = this.readDataFromFile();
    }
    getData() {
        return this.data;
    }
    getLeaderboardSafe(guildId, channelId, messageId) {
        const id = this.leaderboardId(guildId, channelId, messageId);
        let leaderboard = this.data.leaderboards[id];
        if (!leaderboard) {
            leaderboard = { id, guildId, channelId, messageId, entries: [] };
            this.data.leaderboards[id] = leaderboard;
            this.saveLeaderboards();
        }
        return leaderboard;
    }
    updateLeaderboard(client, guildId, channelId, messageId, userId, username, value) {
        const leaderboard = this.getLeaderboardSafe(guildId, channelId, messageId);
        let entry = leaderboard.entries.find((x) => x.userId === userId);
        if (!entry) {
            entry = { userId, username, value, valuePrev: 0, timestamp: Date.now() };
            leaderboard.entries.push(entry);
        }
        else {
            entry.username = username;
            ((entry.valuePrev = entry.value), (entry.value = value));
            entry.timestamp = Date.now();
        }
        this.sortLeaderboardByValueDesc(leaderboard);
        this.saveLeaderboards();
        this.renderLeaderboard(client, leaderboard);
    }
    renderLeaderboard(client, leaderboard) { }
    parseValue(msg) {
        if (msg.author.bot)
            return null;
        return 0;
    }
    readDataFromFile() {
        const leaderboardData = {
            allowedChannels: {},
            leaderboards: {},
        };
        try {
            const raw = fs_1.default.readFileSync(this.filePath, 'utf8');
            const data = JSON.parse(raw);
            Object.keys(data.allowedChannels || {}).forEach((id) => {
                leaderboardData.allowedChannels[id] = data.allowedChannels[id];
            });
            Object.keys(data.leaderboards || {}).forEach((id) => {
                const leaderboardData = data.leaderboards[id] || {};
                const leaderboard = {
                    guildId: leaderboardData.guildId,
                    channelId: leaderboardData.channelId,
                    messageId: leaderboardData.messageId,
                    id: id,
                    entries: [],
                };
                (leaderboardData.entries || []).foreach((entry) => {
                    const leaderboardEntry = {
                        userId: entry.userId,
                        username: entry.username,
                        value: entry.value,
                        valuePrev: entry.valuePrev,
                        timestamp: entry.timestamp,
                    };
                    leaderboard.entries.push(leaderboardEntry);
                });
                this.sortLeaderboardByValueDesc(leaderboard);
                leaderboardData.leaderboards[id] = leaderboard;
            });
        }
        catch {
            return leaderboardData;
        }
        return leaderboardData;
    }
    saveLeaderboards() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.writeLeaderboardsToFile(), 500);
    }
    writeLeaderboardsToFile() {
        fs_1.default.writeFile(this.filePathTemp, JSON.stringify(this.data, null, 2), () => {
            fs_1.default.rename(this.filePathTemp, this.filePath, () => { });
        });
    }
    sortLeaderboardByValueDesc(leaderboard) {
        (leaderboard.entries || []).sort((a, b) => b.value - a.value);
    }
    ensureDataFolderExists() {
        // Ensure data folder exists
        if (!fs_1.default.existsSync(this.dataDir)) {
            fs_1.default.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    leaderboardId(guildId, channelId, messageId) {
        return `${guildId}-${channelId}-${messageId}`;
    }
}
exports.LeaderboardService = LeaderboardService;
