import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const dispute = await prisma.dispute.findUnique({
    where: { id: params.id },
    include: { order: { include: { rfq: true, status_history: { orderBy: { changed_at: 'asc' } } } } },
  });
  if (!dispute) return Errors.notFound();

  return NextResponse.json({ dispute });
}
