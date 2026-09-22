import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { notifyEligibleSuppliers } from '@/lib/rfq/notifyEligibleSuppliers';
import { audit } from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: { items: true, attachments: true } });
  if (!rfq) return Errors.notFound();
  if (rfq.status !== 'UNDER_REVIEW') {
    return Errors.conflict('This action is not available for the current status.');
  }

  const updated = await prisma.rfq.update({
    where: { id: rfq.id },
    data: { status: 'PUBLISHED', published_at: new Date(), rejection_reason: null },
    include: { items: true, attachments: true },
  });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.approved',
    entityType: 'rfq',
    entityId: rfq.id,
    before: { status: rfq.status },
    after: { status: updated.status },
  });

  await notifyEligibleSuppliers(updated);

  return NextResponse.json({ rfq: serializeRfqForViewer('admin', updated) });
}
