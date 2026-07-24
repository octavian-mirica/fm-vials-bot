import { Client, EmbedBuilder, Message } from 'discord.js';
import fs from 'fs';
import path from 'path';
export interface Leaderboard {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  entries: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  value: number;
  valuePrev: number;
  timestamp: number;
}

export interface LeaderboardData {
  allowedChannels: { [guildId: string]: string };
  leaderboards: { [id: string]: Leaderboard };
}

export class LeaderboardService {
  private data: LeaderboardData = { allowedChannels: {}, leaderboards: {} };
  private saveTimeout: any;

  // Path inside dist/
  private dataDir = path.join(__dirname, 'data');
  private filePath = path.join(this.dataDir, 'leaderboards.json');
  private filePathTemp = path.join(this.dataDir, 'leaderboards.tmp.json');

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

  getLeaderboardSafe(
    guildId: string,
    channelId: string,
    messageId: string,
  ): Leaderboard {
    const id = this.leaderboardId(guildId, channelId, messageId);

    let leaderboard = this.data.leaderboards[id];

    if (!leaderboard) {
      leaderboard = { id, guildId, channelId, messageId, entries: [] };
      this.data.leaderboards[id] = leaderboard;
      this.saveLeaderboards();
    }

    return leaderboard;
  }

  updateLeaderboard(
    client: Client,
    guildId: string,
    channelId: string,
    messageId: string,
    userId: string,
    username: string,
    value: number,
  ) {
    const leaderboard = this.getLeaderboardSafe(guildId, channelId, messageId);

    let entry = leaderboard.entries.find((x) => x.userId === userId);
    if (!entry) {
      entry = { userId, username, value, valuePrev: 0, timestamp: Date.now() };
      leaderboard.entries.push(entry);
    } else {
      entry.username = username;
      ((entry.valuePrev = entry.value), (entry.value = value));
      entry.timestamp = Date.now();
    }

    this.sortLeaderboardByValueDesc(leaderboard);
    this.saveLeaderboards();
    this.renderLeaderboard(client, leaderboard);
  }

  renderLeaderboard(client: Client, leaderboard: Leaderboard) {}

  parseValue(msg: Message): number | null {
    if (msg.author.bot) return null;

    return 0;
  }

  private readDataFromFile(): LeaderboardData {
    const leaderboardData: LeaderboardData = {
      allowedChannels: {},
      leaderboards: {},
    };

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);

      Object.keys(data.allowedChannels || {}).forEach((id) => {
        leaderboardData.allowedChannels[id] = data.allowedChannels[id];
      });

      Object.keys(data.leaderboards || {}).forEach((id) => {
        const leaderboardData = data.leaderboards[id] || {};

        const leaderboard: Leaderboard = {
          guildId: leaderboardData.guildId,
          channelId: leaderboardData.channelId,
          messageId: leaderboardData.messageId,
          id: id,
          entries: [],
        };

        (leaderboardData.entries || []).foreach((entry: any) => {
          const leaderboardEntry: LeaderboardEntry = {
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
    } catch {
      return leaderboardData;
    }

    return leaderboardData;
  }

  private saveLeaderboards() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.writeLeaderboardsToFile(), 500);
  }

  private writeLeaderboardsToFile() {
    fs.writeFile(this.filePathTemp, JSON.stringify(this.data, null, 2), () => {
      fs.rename(this.filePathTemp, this.filePath, () => {});
    });
  }

  private sortLeaderboardByValueDesc(leaderboard: Leaderboard) {
    (leaderboard.entries || []).sort((a, b) => b.value - a.value);
  }

  private ensureDataFolderExists() {
    // Ensure data folder exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private leaderboardId(
    guildId: string,
    channelId: string,
    messageId: string,
  ): string {
    return `${guildId}-${channelId}-${messageId}`;
  }
}
