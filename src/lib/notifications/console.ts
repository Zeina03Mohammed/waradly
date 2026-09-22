import type { NotificationChannel, NotificationPayload } from '@/lib/notifications/channel';

/** Dev implementation — writes to stdout instead of sending a real email. */
export class ConsoleNotificationChannel implements NotificationChannel {
  async send(payload: NotificationPayload): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      `[email] to=${payload.to} subject="${payload.subject}"\n${payload.body}\n`,
    );
  }
}

export const emailChannel: NotificationChannel = new ConsoleNotificationChannel();
