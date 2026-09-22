import crypto from 'node:crypto';

/** Raw, single-use tokens for password reset / email verification links (sent by email). */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Only the hash is ever persisted — the raw token exists only in the emailed link. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
