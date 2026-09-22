import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { createRatingSchema } from '@/lib/validation/rating';
import { zodFieldErrors } from '@/lib/validation/auth';
import { applyOrderCompletionSideEffects, recomputeSupplierAverageRating } from '@/lib/order/completion';
import { audit } from '@/lib/audit';

/**
 * Not enumerated as its own row in Section 16 (the ratings table has no listed REST endpoint
 * there), but Sections 2/5.11 explicitly require "Rating Create: Buyer, own order, status =
 * DELIVERED/COMPLETED, one rating per order" with a dedicated screen — this is that endpoint.
 * Submitting the rating is also what moves a DELIVERED order to COMPLETED (Section 10.1 #12).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.buyer_id !== buyerProfile.id) return Errors.notFound();

  if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
    return Errors.conflict('This action is not available for the current status.');
  }

  const existing = await prisma.rating.findUnique({ where: { order_id: order.id } });
  if (existing) return Errors.conflict('You have already rated this order.');

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = createRatingSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const rating = await prisma.$transaction(async (tx) => {
    const created = await tx.rating.create({
      data: {
        order_id: order.id,
        buyer_id: order.buyer_id,
        supplier_id: order.supplier_id,
        score: parsed.data.score,
        comment: parsed.data.comment,
      },
    });

    if (order.status === 'DELIVERED') {
      await tx.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });
      await tx.orderStatusHistory.create({
        data: { order_id: order.id, from_status: 'DELIVERED', to_status: 'COMPLETED', changed_by: auth.user.id },
      });
      await applyOrderCompletionSideEffects(tx, order);
    }
    await recomputeSupplierAverageRating(tx, order.supplier_id);

    return created;
  });

  await audit({ actorId: auth.user.id, action: 'rating.created', entityType: 'rating', entityId: rating.id, after: rating });

  return NextResponse.json({ rating }, { status: 201 });
}
