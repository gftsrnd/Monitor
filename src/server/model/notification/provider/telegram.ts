import { NotificationProvider } from './type.js';
import { telegramContentTokenizer, token } from '../token/index.js';
import axios from 'axios';
import { ImageContentToken } from '../token/type.js';
import { logger } from '../../../utils/logger.js';

interface TelegramPayload {
  botToken: string;
  chatId: string;
}

function isPubliclyFetchableImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const telegram: NotificationProvider = {
  send: async (notification, title, message) => {
    const payload = notification.payload as unknown as TelegramPayload;
    const { botToken, chatId } = payload;

    const text = telegramContentTokenizer.parse([
      token.title(title, 1),
      ...message,
    ]);

    // Primary alert text message (must succeed)
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      },
      { timeout: 15000 }
    );

    // Optional image attachments (best-effort; never fail text delivery if image URL is unreachable)
    const imageTokens = message.filter(
      (m): m is ImageContentToken =>
        m.type === 'image' && isPubliclyFetchableImageUrl(m.url)
    );
    if (imageTokens.length > 0) {
      try {
        if (imageTokens.length === 1) {
          await axios.post(
            `https://api.telegram.org/bot${botToken}/sendPhoto`,
            {
              chat_id: chatId,
              photo: imageTokens[0].url,
            },
            { timeout: 15000 }
          );
        } else {
          await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMediaGroup`,
            {
              chat_id: chatId,
              media: imageTokens.slice(0, 10).map((t) => ({
                type: 'photo',
                media: t.url,
              })),
            },
            { timeout: 15000 }
          );
        }
      } catch (err) {
        logger.warn(
          '[Notification:Telegram] Text alert delivered, optional image attachment skipped:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  },
};
