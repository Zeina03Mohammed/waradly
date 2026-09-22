import type { NotificationChannel } from '@/lib/notifications/channel';
import { ConsoleNotificationChannel } from '@/lib/notifications/console';
import { ResendNotificationChannel } from '@/lib/notifications/resend';

/**
 * Picks the email backend at startup: Resend when RESEND_API_KEY is configured (production),
 * otherwise the console/dev channel. notify.ts imports `emailChannel` from here — never from
 * `./console` or `./resend` directly — so this is the only place that decides.
 */
function createEmailChannel(): NotificationChannel {
  if (process.env.RESEND_API_KEY) return new ResendNotificationChannel();
  return new ConsoleNotificationChannel();
}

export const emailChannel: NotificationChannel = createEmailChannel();
