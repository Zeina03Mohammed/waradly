import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { resolveDisputeSchema } from '@/lib/validation/dispute';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

/** OD-P-04: free-text resolution note + one of three manual outcomes. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = resolveDisputeSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const dispute = await prisma.dispute.findUnique({
    where: { id: params.id },
    include: { order: { include: { rfq: true, buyer: { include: { organization: true } }, supplier: { include: { organization: true } } } } },
  });
  if (!dispute) return Errors.notFound();
  if (dispute.status === 'resolved') return Errors.conflict('This dispute has already been resolved.');

  const newOrderStatus = parsed.data.outcome === 'reopen_production' ? 'PRODUCTION' : 'CANCELLED';

  await prisma.$transaction(async (tx) => {
    await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: 'resolved',
        resolution_outcome: parsed.data.outcome,
        resolution_notes: parsed.data.notes,
        resolved_by: auth.user.id,
        resolved_at: new Date(),
      },
    });
    await tx.order.update({ where: { id: dispute.order_id }, data: { status: newOrderStatus } });
    await tx.orderStatusHistory.create({
      data: {
        order_id: dispute.order_id,
        from_status: 'DISPUTED',
        to_status: newOrderStatus,
        changed_by: auth.user.id,
        note: parsed.data.notes,
      },
    });
    if (newOrderStatus === 'CANCELLED') {
      await tx.rfq.update({ where: { id: dispute.order.rfq_id }, data: { status: 'CLOSED' } });
    }
  });

  await audit({
    actorId: auth.user.id,
    action: 'dispute.resolved',
    entityType: 'dispute',
    entityId: dispute.id,
    before: { status: dispute.status },
    after: { status: 'resolved', outcome: parsed.data.outcome, order_status: newOrderStatus },
  });

  for (const ownerId of [dispute.order.buyer.organization.owner_user_id, dispute.order.supplier.organization.owner_user_id]) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) continue;
    await notify({
      userId: owner.id,
      eventType: 'dispute.resolved',
      message: `The dispute on your order "${dispute.order.rfq.title}" has been resolved.`,
      link: `/orders/${dispute.order_id}`,
      email: {
        to: owner.email,
        subject: 'Your Wardly dispute has been resolved',
        body: `The dispute on your order "${dispute.order.rfq.title}" has been resolved.\n\nOutcome: ${parsed.data.outcome}\n${parsed.data.notes ? `Notes: ${parsed.data.notes}` : ''}`,
      },
    });
  }

  return NextResponse.json({ ok: true, order_status: newOrderStatus });
}
