import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications/notify';
import { getApprovedSupplierIdsForCategory } from '@/lib/rfq/eligibility';

/** Notifies every supplier eligible to see a newly-published RFQ (SPEC.md Section 8.1: "New
 * RFQ available" / "Eligible suppliers notified"), applying any distribution overrides. */
export async function notifyEligibleSuppliers(rfq: { id: string; title: string; category_id: string | null }): Promise<void> {
  if (!rfq.category_id) return;

  const [approvedIds, distributions] = await Promise.all([
    getApprovedSupplierIdsForCategory(rfq.category_id),
    prisma.rfqDistribution.findMany({ where: { rfq_id: rfq.id } }),
  ]);

  const excluded = new Set(distributions.filter((d) => !d.included).map((d) => d.supplier_id));
  const explicitlyIncluded = distributions.filter((d) => d.included).map((d) => d.supplier_id);

  const targetSupplierIds = new Set([...approvedIds.filter((id) => !excluded.has(id)), ...explicitlyIncluded]);

  for (const supplierId of targetSupplierIds) {
    const supplier = await prisma.supplierProfile.findUnique({
      where: { id: supplierId },
      include: { organization: true },
    });
    if (!supplier) continue;
    const owner = await prisma.user.findUnique({ where: { id: supplier.organization.owner_user_id } });
    if (!owner) continue;

    await notify({
      userId: owner.id,
      eventType: 'rfq.new_available',
      message: `A new RFQ is available in your category: "${rfq.title}".`,
      link: `/supplier/rfqs/${rfq.id}`,
      email: {
        to: owner.email,
        subject: 'New RFQ available on Wardly',
        body: `A new RFQ matching your approved category is now open for offers: "${rfq.title}".`,
      },
    });
  }
}
