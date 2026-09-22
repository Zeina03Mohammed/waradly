import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { toAdminUserView } from '@/lib/masking/user';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const user = await prisma.user.findUnique({ where: { id: params.id }, include: { organizations: true } });
  if (!user) return Errors.notFound();

  return NextResponse.json({ user: toAdminUserView(user), organizations: user.organizations });
}
