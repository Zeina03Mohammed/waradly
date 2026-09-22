import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth/session';

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  await prisma.notification.updateMany({ where: { user_id: auth.user.id, read: false }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
