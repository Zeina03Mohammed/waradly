import crypto from 'node:crypto';

const SECRET = process.env.FILE_URL_SECRET ?? 'dev-file-secret-change-me';
export const SIGNED_URL_TTL_MS = 5 * 60 * 1000; // SPEC.md tech-stack decision: 5-minute expiry.

export type FileVariant = 'preview' | 'original';

interface TokenParts {
  fileId: string;
  variant: FileVariant;
  userId: string;
  expiresAt: number;
}

/**
 * The permission check happens once, at the moment /files/{id}/preview|original is called
 * with a normal bearer token (see resolveFileAccess). The signed URL this returns embeds
 * *who* that check was performed for, so the raw-streaming route — which serves bytes to a
 * plain <img>/<a> request with no Authorization header — can re-verify both the signature
 * and, from the embedded user id, that the same access rule still holds, all within a
 * short-lived 5-minute window.
 */
function sign(parts: TokenParts): string {
  const payload = `${parts.fileId}:${parts.variant}:${parts.userId}:${parts.expiresAt}`;
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createSignedFileUrl(fileId: string, variant: FileVariant, userId: string): string {
  const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
  const signature = sign({ fileId, variant, userId, expiresAt });
  const params = new URLSearchParams({ u: userId, e: String(expiresAt), s: signature });
  return `/api/files/raw/${fileId}/${variant}?${params.toString()}`;
}

export function verifySignedFileUrl(parts: TokenParts, signature: string): boolean {
  if (!Number.isFinite(parts.expiresAt) || Date.now() > parts.expiresAt) return false;
  const expected = sign(parts);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
