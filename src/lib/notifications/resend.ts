import { Resend } from 'resend';
import type { NotificationChannel, NotificationPayload } from '@/lib/notifications/channel';

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Waradly <onboarding@resend.dev>';

/** Real email delivery via Resend — the one-file swap the console channel was designed to
 * make easy. Selected automatically by the factory in lib/notifications/index.ts when
 * RESEND_API_KEY is set. */
export class ResendNotificationChannel implements NotificationChannel {
  private client: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Missing required env var for Resend: RESEND_API_KEY');
    this.client = new Resend(apiKey);
  }

  async send(payload: NotificationPayload): Promise<void> {
    const result = await this.client.emails.send({
      from: FROM_ADDRESS,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
    });
    if (result.error) {
      // eslint-disable-next-line no-console
      console.error(`[email] Resend send failed for ${payload.to}:`, result.error);
    }
  }
}
