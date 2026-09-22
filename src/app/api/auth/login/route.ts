import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { loginSchema, zodFieldErrors } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { signAccessToken, signRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/lib/auth/jwt';
import { hashToken } from '@/lib/auth/tokens';
import { toSelfUserView } from '@/lib/masking/user';
import { audit } from '@/lib/audit';

const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return Errors.invalidCredentials();
  }

  const now = new Date();
  if (user.locked_until && user.locked_until > now) {
    return Errors.lockedOut();
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const withinWindow =
      user.last_failed_login_at && now.getTime() - user.last_failed_login_at.getTime() < LOCKOUT_WINDOW_MS;
    const attempts = withinWindow ? user.failed_login_attempts + 1 : 1;
    const locked_until = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_WINDOW_MS) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failed_login_attempts: attempts, last_failed_login_at: now, locked_until },
    });
    await audit({ actorId: user.id, action: 'auth.login_failed', entityType: 'user', entityId: user.id });

    if (locked_until) {
      await audit({ actorId: user.id, action: 'auth.lockout', entityType: 'user', entityId: user.id, after: { locked_until } });
      return Errors.lockedOut();
    }
    return Errors.invalidCredentials();
  }

  if (user.status !== 'active') {
    return Errors.suspended();
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const tokenId = randomUUID();
  const refreshTokenValue = signRefreshToken({ sub: user.id, jti: tokenId });

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        id: tokenId,
        user_id: user.id,
        token_hash: hashToken(refreshTokenValue),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { failed_login_attempts: 0, locked_until: null, last_login_at: now },
    }),
  ]);

  await audit({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });

  return NextResponse.json(
    {
      access_token: accessToken,
      refresh_token: refreshTokenValue,
      user: toSelfUserView(user),
    },
    { status: 200 },
  );
}
