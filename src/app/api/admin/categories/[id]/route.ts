import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

/** Hard delete — not in SPEC.md (which only describes activate/deactivate), added on request.
 * Blocked whenever an RFQ or supplier has ever been linked to the category, matching the
 * RESTRICT foreign keys on rfqs.category_id / supplier_categories.category_id: deleting would
 * otherwise either fail with a raw DB error or (if those FKs are ever loosened) silently orphan
 * RFQ/supplier records. Use deactivate for anything that's actually been used. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return Errors.notFound();

  const [rfqCount, supplierCategoryCount] = await Promise.all([
    prisma.rfq.count({ where: { category_id: category.id } }),
    prisma.supplierCategory.count({ where: { category_id: category.id } }),
  ]);

  if (rfqCount > 0 || supplierCategoryCount > 0) {
    return Errors.conflict('This category has RFQs or suppliers linked to it and cannot be deleted. Deactivate it instead.');
  }

  await prisma.category.delete({ where: { id: category.id } });

  await audit({
    actorId: auth.user.id,
    action: 'category.deleted',
    entityType: 'category',
    entityId: category.id,
    before: category,
  });

  return new NextResponse(null, { status: 204 });
}
