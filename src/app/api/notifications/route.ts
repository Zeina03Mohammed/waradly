import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const notifications = await prisma.notification.findMany({
    where: { user_id: auth.user.id },
    orderBy: { sent_at: 'desc' },
    take: 100,
  });

  return NextResponse.json({ notifications });
}
