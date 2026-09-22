import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { reactivateUserAccount } from '@/lib/users/moderation';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return Errors.notFound();

  await reactivateUserAccount(user.id, auth.user.id);

  return NextResponse.json({ ok: true });
}
