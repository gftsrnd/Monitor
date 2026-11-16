import { NotificationProvider } from './type.js';
import { baseContentTokenizer } from '../token/index.js';
import axios from 'axios';
import dayjs from 'dayjs';

interface WebhookPayload {
  webhookUrl: string;
}

function assertSafeWebhookUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Webhook URL must use http:// or https:// protocol');
  }
  if (process.env.ALLOW_LOCAL_WEBHOOKS !== 'true') {
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
        'Webhook URL cannot target loopback or cloud metadata endpoints'
      );
    }
  }
  return parsed.toString();
}

export const webhook: NotificationProvider = {
  send: async (notification, title, message, payload) => {
    const notificationPayload =
      notification.payload as unknown as WebhookPayload;
    const webhookUrl = assertSafeWebhookUrl(notificationPayload.webhookUrl);

    const content = baseContentTokenizer.parse(message);

    await axios.post(
      webhookUrl,
      {
        source: 'TFG Monitor',
        notification: {
          name: notification.name,
          type: notification.type,
        },
        title,
        content,
        raw: message,
        payload,
        time: dayjs().toISOString(),
      },
      { timeout: 15000 }
    );
  },
};
