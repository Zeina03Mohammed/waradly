import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { canTransitionOrder } from '@/lib/stateMachines/order';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { rfq: true, buyer: { include: { organization: true } } } });
  if (!order || order.supplier_id !== supplierProfile.id) return Errors.notFound();

  if (order.status !== 'PAYMENT_CONFIRMED' || !canTransitionOrder(order.status, 'PRODUCTION')) {
    return Errors.conflict('This action is not available for the current status.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: order.id }, data: { status: 'PRODUCTION' } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: order.status, to_status: 'PRODUCTION', changed_by: auth.user.id },
    });
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.status_changed',
    entityType: 'order',
    entityId: order.id,
    before: { status: order.status },
    after: { status: updated.status },
  });

  const buyerOwnerId = order.buyer.organization.owner_user_id;
  await notify({
    userId: buyerOwnerId,
    eventType: 'order.status_changed',
    message: `Production has started on your order for "${order.rfq.title}".`,
    link: `/buyer/orders/${order.id}/tracking`,
  });

  return NextResponse.json({ order: updated });
}
