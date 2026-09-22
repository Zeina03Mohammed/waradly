import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { refreshSchema, zodFieldErrors } from '@/lib/validation/auth';
import { signAccessToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { hashToken } from '@/lib/auth/tokens';

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = refreshSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const payload = verifyRefreshToken(parsed.data.refresh_token);
  if (!payload) return Errors.unauthenticated();

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (
    !stored ||
    stored.revoked ||
    stored.expires_at < new Date() ||
    stored.token_hash !== hashToken(parsed.data.refresh_token) ||
    stored.user_id !== payload.sub
  ) {
    return Errors.unauthenticated();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'active') return Errors.unauthenticated();

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return NextResponse.json({ access_token: accessToken }, { status: 200 });
}
