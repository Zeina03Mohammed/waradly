import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { matchesFileSignature, sanitizeFilename } from '@/lib/files/constraints';
import { createSignedFileUrl, verifySignedFileUrl } from '@/lib/storage/signedUrl';
import { serializeMessageFor } from '@/lib/messages/serialize';
import type { Message } from '@prisma/client';

// Real magic bytes for each allowed type, plus a chunk of arbitrary payload after them —
// signature checks only need to look at the header, not decode the whole file.
const REAL_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('...rest of a real png...')]);
const REAL_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('...rest of a real jpeg...')]);
const REAL_PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('...rest of a real pdf...')]);
const HTML_PAYLOAD = Buffer.from('<html><body><script>alert(document.cookie)</script></body></html>');

describe('file-signature validation — the declared Content-Type is attacker-controlled, so upload validation must check actual bytes', () => {
  it('accepts real PNG/JPEG/PDF bytes matching their claimed type', () => {
    expect(matchesFileSignature(REAL_PNG, 'image/png')).toBe(true);
    expect(matchesFileSignature(REAL_JPEG, 'image/jpeg')).toBe(true);
    expect(matchesFileSignature(REAL_PDF, 'application/pdf')).toBe(true);
  });

  it('rejects an HTML/script payload uploaded with a spoofed image/png Content-Type', () => {
    // This is the exact bypass a naive `fileEntry.type === 'image/png'` check would miss: the
    // client declares whatever MIME type it wants in the multipart form, independent of the
    // actual bytes.
    expect(matchesFileSignature(HTML_PAYLOAD, 'image/png')).toBe(false);
  });

  it('rejects an HTML/script payload uploaded with a spoofed application/pdf Content-Type', () => {
    expect(matchesFileSignature(HTML_PAYLOAD, 'application/pdf')).toBe(false);
  });

  it('rejects cross-type spoofing (real PDF bytes claiming to be a PNG)', () => {
    expect(matchesFileSignature(REAL_PDF, 'image/png')).toBe(false);
  });

  it('rejects empty/truncated buffers rather than throwing', () => {
    expect(matchesFileSignature(Buffer.alloc(0), 'image/png')).toBe(false);
    expect(matchesFileSignature(Buffer.from([0x89, 0x50]), 'image/png')).toBe(false);
  });
});

describe('filename sanitization — a crafted filename must not break out of the storage key or the Content-Disposition header', () => {
  it('strips directory-traversal segments down to a bare filename', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32\\config')).toBe('config');
  });

  it('strips quote and control characters that could break a quoted Content-Disposition parameter', () => {
    const result = sanitizeFilename('evil".pdf\r\nSet-Cookie: a=b');
    expect(result).not.toContain('"');
    expect(result).not.toMatch(/[\r\n]/);
  });

  it('never returns an empty string', () => {
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('///')).toBe('file');
  });

  it('leaves an ordinary filename untouched', () => {
    expect(sanitizeFilename('invoice-2024.pdf')).toBe('invoice-2024.pdf');
  });
});

describe('signed file URLs — tampering with any embedded field must invalidate the signature', () => {
  it('accepts a signature that matches exactly what was signed', () => {
    const url = createSignedFileUrl('file-1', 'preview', 'user-1');
    const params = new URLSearchParams(url.split('?')[1]);
    const ok = verifySignedFileUrl(
      { fileId: 'file-1', variant: 'preview', userId: 'user-1', expiresAt: Number(params.get('e')) },
      params.get('s')!,
    );
    expect(ok).toBe(true);
  });

  it('rejects the signature if the userId is swapped for a different one (can\'t reuse someone else\'s signed URL by editing the query string)', () => {
    const url = createSignedFileUrl('file-1', 'preview', 'user-1');
    const params = new URLSearchParams(url.split('?')[1]);
    const ok = verifySignedFileUrl(
      { fileId: 'file-1', variant: 'preview', userId: 'attacker-2', expiresAt: Number(params.get('e')) },
      params.get('s')!,
    );
    expect(ok).toBe(false);
  });

  it('rejects the signature if the variant is escalated from preview to original', () => {
    const url = createSignedFileUrl('file-1', 'preview', 'user-1');
    const params = new URLSearchParams(url.split('?')[1]);
    const ok = verifySignedFileUrl(
      { fileId: 'file-1', variant: 'original', userId: 'user-1', expiresAt: Number(params.get('e')) },
      params.get('s')!,
    );
    expect(ok).toBe(false);
  });

  it('rejects an expired signature even with a byte-for-byte correct signature value', () => {
    const url = createSignedFileUrl('file-1', 'preview', 'user-1');
    const params = new URLSearchParams(url.split('?')[1]);
    const ok = verifySignedFileUrl(
      { fileId: 'file-1', variant: 'preview', userId: 'user-1', expiresAt: Date.now() - 1000 },
      params.get('s')!,
    );
    expect(ok).toBe(false);
  });
});

describe('message masking regression — a flagged message must stay masked for everyone except its sender and Admin', () => {
  const baseMessage: Message = {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'sender-1',
    content: 'Call me at 555-1234',
    masked_content: 'Call me at [redacted]',
    flagged: true,
    created_at: new Date(),
  };

  it('the sender sees their own original content', () => {
    const view = serializeMessageFor(baseMessage, 'sender-1', false);
    expect(view.content).toBe('Call me at 555-1234');
  });

  it('the recipient sees masked content once flagged', () => {
    const view = serializeMessageFor(baseMessage, 'recipient-1', false);
    expect(view.content).toBe('Call me at [redacted]');
  });

  it('Admin sees the true original for moderation, regardless of the flag', () => {
    const view = serializeMessageFor(baseMessage, 'some-admin-id', true);
    expect(view.content).toBe('Call me at 555-1234');
  });

  it('an unflagged message is shown as-is to everyone (no false-positive masking)', () => {
    const clean = { ...baseMessage, flagged: false };
    const view = serializeMessageFor(clean, 'recipient-1', false);
    expect(view.content).toBe('Call me at 555-1234');
  });
});

describe('production secret fallback — must fail loudly rather than silently run with a public default', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws at import time in production when the secret env var is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOME_TEST_SECRET', '');
    const { requiredSecret } = await import('@/lib/env');
    expect(() => requiredSecret('SOME_TEST_SECRET', 'insecure-default')).toThrow();
  });

  it('falls back to the dev default outside production (local dev convenience is preserved)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SOME_TEST_SECRET', '');
    const { requiredSecret } = await import('@/lib/env');
    expect(requiredSecret('SOME_TEST_SECRET', 'insecure-default')).toBe('insecure-default');
  });

  it('uses the real env var when it is set, in any environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SOME_TEST_SECRET', 'a-real-secret');
    const { requiredSecret } = await import('@/lib/env');
    expect(requiredSecret('SOME_TEST_SECRET', 'insecure-default')).toBe('a-real-secret');
  });
});
