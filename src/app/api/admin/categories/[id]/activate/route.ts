import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return Errors.notFound();

  const updated = await prisma.category.update({ where: { id: category.id }, data: { status: 'active' } });

  await audit({
    actorId: auth.user.id,
    action: 'category.activated',
    entityType: 'category',
    entityId: category.id,
    before: { status: category.status },
    after: { status: updated.status },
  });

  return NextResponse.json({ category: updated });
}
