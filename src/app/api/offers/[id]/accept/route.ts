import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

/**
 * SPEC.md Section 9.4 — must happen atomically: accept this offer, reject every other offer
 * on the RFQ, award the RFQ, create the Order, and notify winner + losers. We also fold in
 * the order's first automatic transition (OFFER_SELECTED -> PENDING_PAYMENT is "Auto,
 * immediately after creation" per Section 10.1 #2) into the same transaction, writing both
 * status_history rows so the timeline is complete.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const offer = await prisma.offer.findUnique({ where: { id: params.id }, include: { rfq: true } });
  if (!offer || offer.rfq.buyer_id !== buyerProfile.id) return Errors.notFound();

  if (offer.status !== 'SUBMITTED' && offer.status !== 'UNDER_REVIEW') {
    return Errors.conflict('This offer is no longer available, please refresh.');
  }

  const losingOffers = await prisma.offer.findMany({
    where: { rfq_id: offer.rfq_id, id: { not: offer.id }, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    select: { id: true, supplier_id: true },
  });

  const order = await prisma.$transaction(async (tx) => {
    await tx.offer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
    if (losingOffers.length > 0) {
      await tx.offer.updateMany({
        where: { id: { in: losingOffers.map((o) => o.id) } },
        data: { status: 'REJECTED' },
      });
    }
    await tx.rfq.update({ where: { id: offer.rfq_id }, data: { status: 'AWARDED' } });

    const created = await tx.order.create({
      data: {
        rfq_id: offer.rfq_id,
        offer_id: offer.id,
        buyer_id: offer.rfq.buyer_id,
        supplier_id: offer.supplier_id,
        status: 'PENDING_PAYMENT',
        sample_required: offer.rfq.sample_required,
      },
    });

    await tx.orderStatusHistory.create({
      data: { order_id: created.id, from_status: null, to_status: 'OFFER_SELECTED', changed_by: auth.user.id },
    });
    await tx.orderStatusHistory.create({
      data: { order_id: created.id, from_status: 'OFFER_SELECTED', to_status: 'PENDING_PAYMENT', changed_by: auth.user.id },
    });

    return created;
  });

  await audit({
    actorId: auth.user.id,
    action: 'offer.accepted',
    entityType: 'offer',
    entityId: offer.id,
    after: { order_id: order.id },
  });
  await audit({ actorId: auth.user.id, action: 'order.created', entityType: 'order', entityId: order.id, after: order });

  const winner = await getSupplierOwnerUser(offer.supplier_id);
  if (winner) {
    await notify({
      userId: winner.id,
      eventType: 'offer.accepted',
      message: `Your offer on "${offer.rfq.title}" was accepted!`,
      link: `/supplier/orders/${order.id}`,
      email: {
        to: winner.email,
        subject: 'Your Wardly offer was accepted',
        body: `Your offer on "${offer.rfq.title}" was accepted.`,
      },
    });
    // SPEC.md Section 14: "Order created | Buyer + Supplier | In-app + email | High | Confirmation"
    // — a distinct event from "Offer accepted", both required by the table.
    await notify({
      userId: winner.id,
      eventType: 'order.created',
      message: `An order has been created for "${offer.rfq.title}".`,
      link: `/supplier/orders/${order.id}`,
      email: {
        to: winner.email,
        subject: 'Your Wardly order has been created',
        body: `An order has been created for "${offer.rfq.title}". Log in to view next steps.`,
      },
    });
  }

  for (const losing of losingOffers) {
    const owner = await getSupplierOwnerUser(losing.supplier_id);
    if (owner) {
      await notify({
        userId: owner.id,
        eventType: 'offer.rejected',
        message: `Your offer on "${offer.rfq.title}" was not selected.`,
        link: '/supplier/offers',
      });
    }
  }

  // The requester IS the buyer's own account here (buyer accepts their own RFQ's offer).
  await notify({
    userId: auth.user.id,
    eventType: 'order.created',
    message: `Your order for "${offer.rfq.title}" has been created.`,
    link: `/buyer/orders/${order.id}`,
    email: {
      to: auth.user.email,
      subject: 'Your Wardly order has been created',
      body: `Your order for "${offer.rfq.title}" has been created. Please follow the payment instructions agreed with the Wardly team to proceed.`,
    },
  });

  return NextResponse.json({ order }, { status: 200 });
}

async function getSupplierOwnerUser(supplierId: string) {
  const supplier = await prisma.supplierProfile.findUnique({ where: { id: supplierId }, include: { organization: true } });
  if (!supplier) return null;
  return prisma.user.findUnique({ where: { id: supplier.organization.owner_user_id } });
}
