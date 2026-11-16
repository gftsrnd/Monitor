import { NotificationProvider } from './type.js';
import { baseContentTokenizer } from '../token/index.js';
import axios from 'axios';
import dayjs from 'dayjs';

interface TeamsWebhookPayload {
  teamsWebhookUrl: string;
}

function assertSafeTeamsUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Teams Webhook URL must use http:// or https:// protocol');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '169.254.169.254' ||
    host.startsWith('127.') ||
    host.startsWith('169.254.')
  ) {
    throw new Error(
      'Teams Webhook URL cannot target loopback or cloud metadata endpoints'
    );
  }
  return parsed.toString();
}

export const teams: NotificationProvider = {
  send: async (notification, title, message) => {
    const payload = notification.payload as unknown as TeamsWebhookPayload;
    const teamsWebhookUrl = assertSafeTeamsUrl(payload.teamsWebhookUrl);

    const text = baseContentTokenizer.parse(message);

    await axios.post(
      teamsWebhookUrl,
      {
        source: 'TFG Monitor',
        notification: {
          id: notification.id,
          name: notification.name,
          type: notification.type,
        },
        title,
        text,
        raw: message,
        time: dayjs().toISOString(),
      },
      { timeout: 15000 }
    );
  },
};
