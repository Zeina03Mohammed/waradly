import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const NON_CANCELLABLE = ['AWARDED', 'CLOSED'];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: { attachments: true, items: true } });
  if (!rfq || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();

  // SPEC.md Section 2 (RFQ Cancel: "status not AWARDED/CLOSED") and the CANCELLED row's own
  // entry conditions state cancellation is allowed from ANY non-terminal status — broader than
  // the per-source-state "Allowed Next" column in the 8.1 table, which only lists CANCELLED
  // for PUBLISHED/RECEIVING_OFFERS. We follow the more specific, more explicit rule here
  // rather than the generic RFQ_TRANSITIONS map (see lib/stateMachines/rfq.ts).
  if (NON_CANCELLABLE.includes(rfq.status)) {
    return Errors.conflict('This action is not available for the current status.');
  }

  const json = await request.json().catch(() => ({}));
  const reason = typeof json?.reason === 'string' ? json.reason : null;

  const before = rfq.status;

  const offeringSuppliers = await prisma.offer.findMany({
    where: { rfq_id: rfq.id },
    select: { supplier_id: true },
    distinct: ['supplier_id'],
  });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.rfq.update({ where: { id: rfq.id }, data: { status: 'CANCELLED' } });
    await tx.offer.updateMany({
      where: { rfq_id: rfq.id, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      data: { status: 'REJECTED' },
    });
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.cancelled',
    entityType: 'rfq',
    entityId: rfq.id,
    before: { status: before },
    after: { status: updated.status, reason },
  });

  for (const { supplier_id } of offeringSuppliers) {
    const supplier = await prisma.supplierProfile.findUnique({ where: { id: supplier_id }, include: { organization: true } });
    if (!supplier) continue;
    const owner = await prisma.user.findUnique({ where: { id: supplier.organization.owner_user_id } });
    if (!owner) continue;
    await notify({
      userId: owner.id,
      eventType: 'rfq.cancelled',
      message: `An RFQ you offered on ("${rfq.title}") was cancelled by the buyer.`,
      link: '/supplier/offers',
    });
  }

  return NextResponse.json({ rfq: serializeRfqForViewer('owner', { ...rfq, ...updated }) });
}
