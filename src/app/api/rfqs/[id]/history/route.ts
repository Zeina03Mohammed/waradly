import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'admin');
  if (denied) return denied;

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq) return Errors.notFound();

  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();
  }

  const history = await prisma.auditLog.findMany({
    where: { entity_type: 'rfq', entity_id: rfq.id },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({ history });
}
