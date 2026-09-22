import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const notification = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notification || notification.user_id !== auth.user.id) return Errors.notFound();

  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
  return NextResponse.json({ notification: updated });
}
