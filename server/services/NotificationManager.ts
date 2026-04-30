import fs from 'fs-extra';
import path from 'path';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'success' | 'failure' | 'info';
  appId?: string;
  details?: string;
}

export class NotificationManager {
  private configPath: string;
  private slackWebhook: string | undefined;
  private discordWebhook: string | undefined;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'notifications.json');
    fs.ensureDirSync(path.dirname(this.configPath));
    this.loadConfig();
  }

  private loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = fs.readJsonSync(this.configPath);
        this.slackWebhook = config.slackWebhook;
        this.discordWebhook = config.discordWebhook;
      } else {
        this.slackWebhook = process.env.SLACK_WEBHOOK_URL;
        this.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
      }
    } catch (err) {
      console.error('[NotificationManager] Failed to load config:', err);
    }
  }

  async saveConfig(slack?: string, discord?: string) {
    this.slackWebhook = slack;
    this.discordWebhook = discord;
    await fs.writeJson(this.configPath, { slackWebhook: slack, discordWebhook: discord }, { spaces: 2 });
  }

  getConfig() {
    return {
      slackWebhook: this.slackWebhook,
      discordWebhook: this.discordWebhook
    };
  }

  async send(payload: NotificationPayload) {
    if (this.slackWebhook) {
      await this.sendToSlack(payload);
    }
    if (this.discordWebhook) {
      await this.sendToDiscord(payload);
    }
  }

  private async sendToSlack(payload: NotificationPayload) {
    if (!this.slackWebhook) return;
    const color = payload.type === 'success' ? '#0d9488' : payload.type === 'failure' ? '#ef4444' : '#3b82f6';
    
    try {
      await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color,
            title: payload.title,
            text: payload.message,
            fields: [
              { title: 'App ID', value: payload.appId || 'System', short: true },
              { title: 'Status', value: payload.type.toUpperCase(), short: true },
              { title: 'Details', value: payload.details || 'N/A', short: false }
            ],
            footer: 'Stillwater Suite Ops Hub',
            ts: Math.floor(Date.now() / 1000)
          }]
        })
      });
    } catch (err) {
      console.error('[NotificationManager] Failed to send to Slack:', err);
    }
  }

  private async sendToDiscord(payload: NotificationPayload) {
    if (!this.discordWebhook) return;
    const color = payload.type === 'success' ? 0x0d9488 : payload.type === 'failure' ? 0xef4444 : 0x3b82f6;

    try {
      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: payload.title,
            description: payload.message,
            color,
            fields: [
              { name: 'App ID', value: payload.appId || 'System', inline: true },
              { name: 'Status', value: payload.type.toUpperCase(), inline: true },
              { name: 'Details', value: payload.details || 'N/A' }
            ],
            footer: { text: 'Stillwater Suite Ops Hub' },
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (err) {
      console.error('[NotificationManager] Failed to send to Discord:', err);
    }
  }
}

export const notificationManager = new NotificationManager();
