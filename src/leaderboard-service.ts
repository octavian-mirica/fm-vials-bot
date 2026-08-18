import { Client, EmbedBuilder, Message, TextChannel } from 'discord.js';
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
  private isDatabaseLoaded = false;

  // Path inside dist/
  private dataDir = path.join(__dirname, 'data');
  private filePath = path.join(this.dataDir, 'leaderboards.json');
  private filePathTemp = path.join(this.dataDir, 'leaderboards.tmp.json');

  constructor() {
    this.loadData();
  }

  getData() {
    return this.data;
  }

  async updateLeaderboard(client: Client, msg: Message) {
    if (!this.isDatabaseLoaded) {
      return;
    }

    const guildId = msg.guildId || '';
    const channelId = msg.channelId;
    const userId = msg.author.id;
    const username =
      msg.member?.nickname || msg.author.globalName || msg.author.username;

    if (msg.author.bot || !this.isChannelAllowed(guildId, channelId)) {
      return;
    }

    const value = await this.parseMessageValue(msg);
    if (value === null) {
      return;
    }

    const leaderboard = await this.getLeaderboardSafe(
      client,
      guildId,
      channelId,
    );

    let entry = leaderboard.entries.find((x) => x.userId === msg.author.id);
    if (!entry) {
      entry = { userId, username, value, valuePrev: 0, timestamp: Date.now() };
      leaderboard.entries.push(entry);
    } else {
      entry.username = username;
      entry.valuePrev = entry.value;
      entry.value = value;
      entry.timestamp = Date.now();
    }

    this.sortLeaderboardByValueDesc(leaderboard);
    this.filterLeaderboardOlderThan(leaderboard, 7);
    this.saveLeaderboards();
    this.renderLeaderboard(client, leaderboard);
  }

  async renderLeaderboard(
    client: Client,
    leaderboard: Leaderboard,
  ): Promise<void> {
    const channel = client.channels.cache.get(leaderboard.channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(
        `Leaderboard channel ${leaderboard.channelId} not found or not text-based.`,
      );
      return;
    }

    let message;
    try {
      message = await channel.messages.fetch(leaderboard.messageId);
    } catch (err) {
      console.error(
        `Failed to fetch leaderboard message ${leaderboard.messageId}:`,
        err,
      );
      return;
    }

    try {
      await message.edit({
        content: null,
        embeds: [this.buildLeaderboardEmbed(leaderboard)],
      });
    } catch (err) {
      console.error(
        `Failed to edit leaderboard message ${leaderboard.messageId}:`,
        err,
      );
    }
  }

  private buildLeaderboardEmbed(leaderboard: Leaderboard): EmbedBuilder {
    const USER_WIDTH = 20;
    const VALUE_WIDTH = 6;

    let totalValue = this.getLeaderboardTotal(leaderboard);
    const rows: string[] = [];

    for (let i = 0; i < leaderboard.entries.length; i++) {
      const entry = leaderboard.entries[i];

      const rank = `${i + 1}.`;
      let userCol = `${rank} ${entry.username}`;

      if (userCol.length > USER_WIDTH) {
        userCol = userCol.slice(0, USER_WIDTH);
      }
      userCol = userCol.padEnd(USER_WIDTH, ' ');

      const valueCol = String(entry.value).padStart(VALUE_WIDTH, ' ');

      const ts = Math.floor(entry.timestamp / 1000);
      const ago = `<t:${ts}:R>`;

      rows.push(`\`${userCol} ${valueCol}\`   ${ago}`);
    }

    const totalUser = 'Total'.padEnd(USER_WIDTH, ' ');
    const totalVal = String(totalValue).padStart(VALUE_WIDTH, ' ');
    rows.push('');
    rows.push(
      `\`${totalUser} ${totalVal}\`   ${leaderboard.entries.length} players`,
    );

    return new EmbedBuilder()
      .setColor(0x00aeef)
      .setTitle('Clan Vials Leaderboard')
      .setDescription(rows.join('\n'));
  }

  private async parseMessageValue(msg: Message): Promise<number | null> {
    if (
      msg.author.bot ||
      !this.isChannelAllowed(msg.guild?.id || '', msg.channelId)
    ) {
      return null;
    }

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
      }, 2000);
      return null;
    }

    // Always delete the user message
    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 3000);

    return value;
  }

  private isChannelAllowed(guildId: string, channelId: string): boolean {
    return this.data.allowedChannels[guildId] === channelId;
  }

  private async getLeaderboardSafe(
    client: Client,
    guildId: string,
    channelId: string,
  ): Promise<Leaderboard> {
    const id = this.leaderboardId(guildId, channelId);

    let leaderboard = this.data.leaderboards[id];

    if (!leaderboard) {
      leaderboard = {
        id,
        guildId,
        channelId,
        messageId: '',
        entries: [],
      };
      this.data.leaderboards[id] = leaderboard;
    }

    await this.getLeaderboardMessageSafe(client, leaderboard);
    this.saveLeaderboards();

    return leaderboard;
  }

  private async getLeaderboardMessageSafe(
    client: Client,
    leaderboard: Leaderboard,
  ): Promise<Message | null> {
    const channel = client.channels.cache.get(leaderboard.channelId);

    if (!channel || !channel.isTextBased()) {
      console.error(
        `Channel ${leaderboard.channelId} not found or not text-based.`,
      );
      return null;
    }

    // If we don't have a messageId yet, create the placeholder immediately
    if (!leaderboard.messageId) {
      const placeholder = '```\nLeaderboard initializing...\n```';
      const newMsg = await (channel as TextChannel).send(placeholder);
      leaderboard.messageId = newMsg.id;
      return newMsg;
    }

    try {
      return await channel.messages.fetch(leaderboard.messageId);
    } catch (err) {
      console.error(
        `Failed to fetch leaderboard message ${leaderboard.messageId} in channel ${leaderboard.channelId}:`,
        err,
      );

      const placeholder = '```\nLeaderboard initializing...\n```';
      const newMsg = await (channel as TextChannel).send(placeholder);
      leaderboard.messageId = newMsg.id;
      return newMsg;
    }
  }

  private getLeaderboardTotal(leaderboard: Leaderboard) {
    return (leaderboard.entries || []).reduce(
      (total, entry) => total + entry.value,
      0,
    );
  }

  private loadData() {
    this.ensureDataFolderExists();
    this.data = this.readDataFromFile();
    console.log('Database loaded!');
    this.isDatabaseLoaded = true;
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

  private filterLeaderboardOlderThan(leaderboard: Leaderboard, days: number) {
    const daysMs = days * 24 * 60 * 60 * 1000; // Remove players older than 7 days
    const cutoff = Date.now() - daysMs;

    leaderboard.entries = leaderboard.entries.filter(
      (e) => e.timestamp >= cutoff,
    );
  }

  private ensureDataFolderExists() {
    // Ensure data folder exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private leaderboardId(guildId: string, channelId: string): string {
    return `${guildId}-${channelId}`;
  }
}
