import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  const refreshToken = typeof json?.refresh_token === 'string' ? json.refresh_token : null;

  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { user_id: auth.user.id, token_hash: hashToken(refreshToken) },
      data: { revoked: true },
    });
  }

  await audit({ actorId: auth.user.id, action: 'auth.logout', entityType: 'user', entityId: auth.user.id });

  return new NextResponse(null, { status: 204 });
}
