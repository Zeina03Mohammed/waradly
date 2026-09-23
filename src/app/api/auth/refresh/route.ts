import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { refreshSchema, zodFieldErrors } from '@/lib/validation/auth';
import { signAccessToken, signRefreshToken, verifyRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/lib/auth/jwt';
import { hashToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/audit';

/**
 * Refresh tokens rotate on every use: the presented one is revoked and a brand-new one is
 * issued in the same response, so a token is only ever valid for a single refresh call.
 *
 * Reuse detection: if the presented token is found but already revoked, that's not a normal
 * "expired session" case — it means this exact token was already exchanged once before, and
 * someone (attacker or a stale second client) is replaying it. Treat that as a signal the
 * refresh token was stolen and kill every session for the account, not just this one.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = refreshSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const payload = verifyRefreshToken(parsed.data.refresh_token);
  if (!payload) return Errors.unauthenticated();

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!stored || stored.token_hash !== hashToken(parsed.data.refresh_token) || stored.user_id !== payload.sub) {
    return Errors.unauthenticated();
  }

  if (stored.revoked) {
    await prisma.refreshToken.updateMany({ where: { user_id: stored.user_id, revoked: false }, data: { revoked: true } });
    await audit({
      actorId: stored.user_id,
      action: 'auth.refresh_token_reuse_detected',
      entityType: 'user',
      entityId: stored.user_id,
      after: { revoked_token_id: stored.id },
    });
    return Errors.unauthenticated();
  }

  if (stored.expires_at < new Date()) {
    return Errors.unauthenticated();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'active') return Errors.unauthenticated();

  const newTokenId = randomUUID();
  const newRefreshToken = signRefreshToken({ sub: user.id, jti: newTokenId });

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } }),
    prisma.refreshToken.create({
      data: {
        id: newTokenId,
        user_id: user.id,
        token_hash: hashToken(newRefreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return NextResponse.json({ access_token: accessToken, refresh_token: newRefreshToken }, { status: 200 });
}
