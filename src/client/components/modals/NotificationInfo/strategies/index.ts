import React from 'react';
import { NotificationSMTP } from './smtp';
import { NotificationTelegram } from './telegram';
import { NotificationApprise } from './apprise';
import { NotificationFeishu } from './feishu';
import { NotificationWebhook } from './webhook';
import { NotificationTeams } from './teams';

interface NotificationStrategy {
  label: string;
  name: string;
  form: React.ComponentType;
}

export const notificationStrategies: NotificationStrategy[] = [
  {
    label: 'Telegram',
    name: 'telegram',
    form: NotificationTelegram,
  },
  {
    label: 'Email(SMTP)',
    name: 'smtp',
    form: NotificationSMTP,
  },
  {
    label: 'Webhook',
    name: 'webhook',
    form: NotificationWebhook,
  },
  {
    label: 'Apprise(Support 90+ services)',
    name: 'apprise',
    form: NotificationApprise,
  },
  {
    label: 'Teams',
    name: 'teams',
    form: NotificationTeams,
  },
  {
    label: 'Feishu',
    name: 'feishu',
    form: NotificationFeishu,
  },
];
