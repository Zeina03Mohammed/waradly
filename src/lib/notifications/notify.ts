import { prisma } from '@/lib/prisma';
import { emailChannel } from '@/lib/notifications';

/**
 * Wires a Section 14 event to the notifications table. Each row carries exactly one channel
 * (matching the notifications schema), so a "High priority" event that needs both in-app and
 * email produces two rows — one per channel — rather than overloading a single row.
 */
export async function notify(params: {
  userId: string;
  eventType: string;
  message: string;
  link?: string;
  email?: { to: string; subject: string; body: string };
}): Promise<void> {
  await prisma.notification.create({
    data: {
      user_id: params.userId,
      event_type: params.eventType,
      channel: 'in_app',
      message: params.message,
      link: params.link ?? null,
    },
  });

  if (params.email) {
    await prisma.notification.create({
      data: {
        user_id: params.userId,
        event_type: params.eventType,
        channel: 'email',
        message: params.message,
        link: params.link ?? null,
      },
    });
    await emailChannel.send(params.email);
  }
}
