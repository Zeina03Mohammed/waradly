import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { validateRfqForSubmit } from '@/lib/validation/rfq';
import { canTransitionRfq } from '@/lib/stateMachines/rfq';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { audit } from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  if (!auth.user.email_verified_at) {
    return errorResponse(403, 'FORBIDDEN', 'Verify your email before submitting an RFQ for review.');
  }

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: { attachments: true, items: true } });
  if (!rfq || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();

  if (!canTransitionRfq(rfq.status, 'SUBMITTED')) {
    return Errors.conflict('This action is not available for the current status.');
  }

  const fieldErrors = validateRfqForSubmit({
    category_id: rfq.category_id,
    title: rfq.title,
    quantity: rfq.quantity,
    unit: rfq.unit,
    delivery_deadline: rfq.delivery_deadline,
    delivery_region: rfq.delivery_region,
    offer_deadline_at: rfq.offer_deadline_at,
    printing_customization: rfq.printing_customization,
    attachmentCount: rfq.attachments.length,
  });
  if (fieldErrors) return Errors.validation(fieldErrors);

  const before = rfq.status;
  const updated = await prisma.rfq.update({ where: { id: rfq.id }, data: { status: 'SUBMITTED' } });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.submitted',
    entityType: 'rfq',
    entityId: rfq.id,
    before: { status: before },
    after: { status: updated.status },
  });

  return NextResponse.json({ rfq: serializeRfqForViewer('owner', { ...rfq, ...updated }) });
}
