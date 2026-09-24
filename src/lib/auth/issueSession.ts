import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken, signRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/lib/auth/jwt';
import { hashToken } from '@/lib/auth/tokens';

/** Shared by every login path (password, WebAuthn) that ends in "issue a real session" — the
 * one place a refresh token gets minted and failed-login counters reset, so both flows stay in
 * lockstep instead of drifting if only one gets updated later. */
export async function issueSessionTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const tokenId = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, jti: tokenId });

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        id: tokenId,
        user_id: user.id,
        token_hash: hashToken(refreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { failed_login_attempts: 0, locked_until: null, last_login_at: new Date() },
    }),
  ]);

  return { accessToken, refreshToken };
}
