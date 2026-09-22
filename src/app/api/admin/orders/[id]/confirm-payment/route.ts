import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

/** OD-P-01: no payment gateway exists in P0. Admin verifies receipt off-platform and manually
 * flips the status. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { rfq: true, buyer: { include: { organization: true } }, supplier: { include: { organization: true } } },
  });
  if (!order) return Errors.notFound();
  if (order.status !== 'PENDING_PAYMENT') {
    return Errors.conflict('This action is not available for the current status.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_CONFIRMED' } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: 'PENDING_PAYMENT', to_status: 'PAYMENT_CONFIRMED', changed_by: auth.user.id },
    });
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.payment_confirmed',
    entityType: 'order',
    entityId: order.id,
    before: { status: 'PENDING_PAYMENT' },
    after: { status: updated.status },
  });

  for (const ownerId of [order.buyer.organization.owner_user_id, order.supplier.organization.owner_user_id]) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) continue;
    await notify({
      userId: owner.id,
      eventType: 'order.status_changed',
      message: `Payment has been confirmed for order "${order.rfq.title}".`,
      link: `/orders/${order.id}`,
      email: {
        to: owner.email,
        subject: 'Payment confirmed on Waradly',
        body: `Payment has been confirmed for the order "${order.rfq.title}". Production can now proceed.`,
      },
    });
  }

  return NextResponse.json({ order: updated });
}
