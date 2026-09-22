import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getApprovedSupplierIdsForCategory } from '@/lib/rfq/eligibility';
import { audit } from '@/lib/audit';

const distributionSchema = z.object({
  supplier_ids: z.array(z.string().uuid()),
});

/**
 * SPEC.md Section 7.7: default distribution is "all approved suppliers for this category";
 * this endpoint lets Admin override it. `supplier_ids` is the desired final set of suppliers
 * who should see the RFQ. Approved-for-category suppliers left out of that set get an explicit
 * exclusion row; suppliers in the set who aren't otherwise approved get an explicit inclusion
 * row. Everyone else needs no override row (the default applies).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = distributionSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq) return Errors.notFound();
  if (!rfq.category_id) return Errors.conflict('This RFQ has no category set yet.');

  const approvedIds = new Set(await getApprovedSupplierIdsForCategory(rfq.category_id));
  const desired = new Set(parsed.data.supplier_ids);

  const overrides: { supplier_id: string; included: boolean }[] = [];
  for (const supplierId of approvedIds) {
    if (!desired.has(supplierId)) overrides.push({ supplier_id: supplierId, included: false });
  }
  for (const supplierId of desired) {
    if (!approvedIds.has(supplierId)) overrides.push({ supplier_id: supplierId, included: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.rfqDistribution.deleteMany({ where: { rfq_id: rfq.id } });
    if (overrides.length > 0) {
      await tx.rfqDistribution.createMany({
        data: overrides.map((o) => ({ rfq_id: rfq.id, supplier_id: o.supplier_id, included: o.included })),
      });
    }
  });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.distribution_updated',
    entityType: 'rfq',
    entityId: rfq.id,
    after: { supplier_ids: Array.from(desired) },
  });

  return NextResponse.json({ ok: true, overrides });
}
