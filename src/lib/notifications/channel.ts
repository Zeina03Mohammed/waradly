/**
 * NotificationChannel — SPEC.md tech stack decision: a swappable interface so a real email
 * provider is a one-file swap later. The dev implementation just logs to stdout.
 */
export interface NotificationPayload {
  to: string; // email address, for the dev/console channel
  subject: string;
  body: string;
}

export interface NotificationChannel {
  send(payload: NotificationPayload): Promise<void>;
}
