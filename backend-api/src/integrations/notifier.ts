import type { Logger } from 'pino';

export interface NotificationDispatchItem {
  id: string;
  user_id: string;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  template: string;
  payload: Record<string, unknown>;
}

export interface NotifierPort {
  send(item: NotificationDispatchItem): Promise<void>;
}

const GENERIC_TEMPLATES: Record<string, string> = {
  emergency_profile_accessed:
    'Your emergency medical profile was accessed. Open SmartHealth for details.',
  access_grant_created: 'A doctor access grant was activated on your SmartHealth account.',
  rx_dispensed: 'Your prescription has been dispensed. Open SmartHealth for details.',
};

export function createNotifier(logger: Logger): NotifierPort {
  return {
    async send(item) {
      const bodyPreview = GENERIC_TEMPLATES[item.template] ?? 'SmartHealth security notification';
      logger.info(
        {
          notification_id: item.id,
          channel: item.channel,
          template: item.template,
          has_preview: bodyPreview.length > 0,
        },
        'Dispatched notification without PHI payload',
      );
    },
  };
}
