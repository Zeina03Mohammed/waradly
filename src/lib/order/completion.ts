import type { Prisma } from '@prisma/client';

/** SPEC.md Section 10.1 #12 (COMPLETED): "supplier_profiles.completed_orders_count +1 ...
 * linked RFQ -> CLOSED". Shared because an order can reach COMPLETED either via the buyer's
 * rating (POST /orders/{id}/rate) or Admin closing it directly through the generic status
 * endpoint after a timeout. */
export async function applyOrderCompletionSideEffects(
  tx: Prisma.TransactionClient,
  order: { id: string; rfq_id: string; supplier_id: string },
): Promise<void> {
  await tx.rfq.update({ where: { id: order.rfq_id }, data: { status: 'CLOSED' } });
  await tx.supplierProfile.update({ where: { id: order.supplier_id }, data: { completed_orders_count: { increment: 1 } } });
}

export async function recomputeSupplierAverageRating(tx: Prisma.TransactionClient, supplierId: string): Promise<void> {
  const agg = await tx.rating.aggregate({ where: { supplier_id: supplierId }, _avg: { score: true } });
  await tx.supplierProfile.update({ where: { id: supplierId }, data: { average_rating: agg._avg.score ?? null } });
}
