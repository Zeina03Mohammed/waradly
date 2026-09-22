import { prisma } from '@/lib/prisma';

/**
 * Whether a supplier is eligible to see/quote a given RFQ. Default rule is "approved for the
 * RFQ's category"; an RfqDistribution override (Section 7.7) can explicitly exclude an
 * otherwise-approved supplier, or include one that isn't approved (visibility only — offer
 * submission still separately requires category approval per Section 9.2/16).
 */
export async function isSupplierEligibleForRfqFeed(
  supplierId: string,
  rfq: { id: string; category_id: string | null },
): Promise<boolean> {
  const distribution = await prisma.rfqDistribution.findUnique({
    where: { rfq_id_supplier_id: { rfq_id: rfq.id, supplier_id: supplierId } },
  });
  if (distribution) return distribution.included;

  if (!rfq.category_id) return false;
  const approval = await prisma.supplierCategory.findUnique({
    where: { supplier_id_category_id: { supplier_id: supplierId, category_id: rfq.category_id } },
  });
  return !!approval?.approved;
}

export async function getApprovedSupplierIdsForCategory(categoryId: string): Promise<string[]> {
  const rows = await prisma.supplierCategory.findMany({
    where: { category_id: categoryId, approved: true },
    select: { supplier_id: true },
  });
  return rows.map((r) => r.supplier_id);
}
