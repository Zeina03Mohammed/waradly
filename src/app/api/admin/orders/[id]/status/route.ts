import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { adminOrderStatusSchema } from '@/lib/validation/order';
import { zodFieldErrors } from '@/lib/validation/auth';
import { canTransitionOrder, EVIDENCE_REQUIRED_STATUSES } from '@/lib/stateMachines/order';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { applyOrderCompletionSideEffects } from '@/lib/order/completion';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const HIGH_PRIORITY_EMAIL_STATUSES = ['PAYMENT_CONFIRMED', 'DELIVERED'];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = adminOrderStatusSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const { to_status, evidence_file_id, note } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      rfq: true,
      buyer: { include: { organization: true } },
      supplier: { include: { organization: true } },
    },
  });
  if (!order) return Errors.notFound();

  // Only the dedicated dispute-resolve endpoint may move an order out of DISPUTED
  // (SPEC.md Section 16: PATCH /admin/disputes/{id}/resolve).
  if (order.status === 'DISPUTED') {
    return Errors.conflict('This order has an open dispute — resolve it via the dispute record first.');
  }
  if (!canTransitionOrder(order.status, to_status)) {
    return Errors.conflict('This action is not available for the current status.');
  }
  if (EVIDENCE_REQUIRED_STATUSES.includes(to_status) && !evidence_file_id && !note) {
    return Errors.validation({ evidence: 'Evidence (a file or a note) is required for this transition.' });
  }
  if (evidence_file_id) {
    const owned = await allFilesOwnedBy([evidence_file_id], auth.user.id);
    if (!owned) return Errors.validation({ evidence_file_id: 'This file was not uploaded by you.' });
  }

  const before = order.status;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: to_status } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: before, to_status, changed_by: auth.user.id, evidence_file_id, note },
    });

    if (to_status === 'CANCELLED') {
      await tx.rfq.update({ where: { id: order.rfq_id }, data: { status: 'CLOSED' } });
    }
    if (to_status === 'COMPLETED') {
      // Admin closing the order directly (e.g. after a ratings timeout) applies the same
      // side-effects a buyer's rating would (Section 10.1 #12).
      await applyOrderCompletionSideEffects(tx, order);
    }
    if (to_status === 'DISPUTED') {
      await tx.dispute.create({
        data: {
          order_id: order.id,
          raised_by: auth.user.id,
          category: 'admin_opened',
          description: note ?? 'Opened by Admin.',
        },
      });
    }

    return updated;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.status_changed',
    entityType: 'order',
    entityId: order.id,
    before: { status: before },
    after: { status: result.status, note: note ?? null, evidence_file_id: evidence_file_id ?? null },
  });

  await notifyOrderStatusChange(order, to_status, before);

  return NextResponse.json({ order: result });
}

async function notifyOrderStatusChange(
  order: {
    id: string;
    rfq: { title: string };
    buyer: { organization: { owner_user_id: string } };
    supplier: { organization: { owner_user_id: string } };
  },
  toStatus: string,
  fromStatus: string,
) {
  const buyerOwnerId = order.buyer.organization.owner_user_id;
  const supplierOwnerId = order.supplier.organization.owner_user_id;
  const withEmail = HIGH_PRIORITY_EMAIL_STATUSES.includes(toStatus);

  const buyerOwner = await prisma.user.findUnique({ where: { id: buyerOwnerId } });
  if (buyerOwner) {
    await notify({
      userId: buyerOwner.id,
      eventType: 'order.status_changed',
      message: `Your order for "${order.rfq.title}" is now ${toStatus.replace(/_/g, ' ').toLowerCase()}.`,
      link: `/buyer/orders/${order.id}/tracking`,
      ...(withEmail
        ? { email: { to: buyerOwner.email, subject: 'Wardly order status update', body: `Your order for "${order.rfq.title}" is now ${toStatus}.` } }
        : {}),
    });
  }

  const notifySupplierToo =
    ['RECEIVED_AT_HUB', 'DELIVERED', 'CANCELLED', 'PAYMENT_CONFIRMED'].includes(toStatus) ||
    (toStatus === 'QC_COMPLETED' && fromStatus === 'DISPUTED');

  if (notifySupplierToo) {
    const supplierOwner = await prisma.user.findUnique({ where: { id: supplierOwnerId } });
    if (supplierOwner) {
      await notify({
        userId: supplierOwner.id,
        eventType: 'order.status_changed',
        message: `Order for "${order.rfq.title}" is now ${toStatus.replace(/_/g, ' ').toLowerCase()}.`,
        link: `/supplier/orders/${order.id}`,
        ...(withEmail
          ? { email: { to: supplierOwner.email, subject: 'Wardly order status update', body: `Order for "${order.rfq.title}" is now ${toStatus}.` } }
          : {}),
      });
    }
  }
}
