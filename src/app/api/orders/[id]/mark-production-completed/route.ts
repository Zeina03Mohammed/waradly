import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
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

  if (order.status !== 'PRODUCTION') {
    return Errors.conflict('This action is not available for the current status.');
  }

  // Section 10.1 #6 requires "sample approved if required" — since PRODUCTION is re-entered
  // after both an initial start and a sample approval, we distinguish the two by checking for
  // a completed SAMPLE_REVIEW -> PRODUCTION approval in the order's own history.
  if (order.sample_required) {
    const approved = await prisma.orderStatusHistory.findFirst({
      where: { order_id: order.id, from_status: 'SAMPLE_REVIEW', to_status: 'PRODUCTION' },
    });
    if (!approved) {
      return Errors.conflict('The sample must be submitted and approved before production can be marked complete.');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: order.id }, data: { status: 'PRODUCTION_COMPLETED' } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: 'PRODUCTION', to_status: 'PRODUCTION_COMPLETED', changed_by: auth.user.id },
    });
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.status_changed',
    entityType: 'order',
    entityId: order.id,
    before: { status: 'PRODUCTION' },
    after: { status: updated.status },
  });

  await notify({
    userId: order.buyer.organization.owner_user_id,
    eventType: 'order.status_changed',
    message: `Production is complete for your order "${order.rfq.title}".`,
    link: `/buyer/orders/${order.id}/tracking`,
  });

  return NextResponse.json({ order: updated });
}
