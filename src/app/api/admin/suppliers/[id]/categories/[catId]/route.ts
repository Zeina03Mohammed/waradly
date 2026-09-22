import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { approveCategorySchema } from '@/lib/validation/category';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; catId: string } },
) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = approveCategorySchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const row = await prisma.supplierCategory.findUnique({
    where: { supplier_id_category_id: { supplier_id: params.id, category_id: params.catId } },
  });
  if (!row) return Errors.notFound();

  const before = row;
  const updated = await prisma.supplierCategory.update({
    where: { id: row.id },
    data: { approved: parsed.data.approved, approved_at: parsed.data.approved ? new Date() : null },
  });

  await audit({
    actorId: auth.user.id,
    action: 'supplier_category.approval_changed',
    entityType: 'supplier_category',
    entityId: updated.id,
    before,
    after: updated,
  });

  return NextResponse.json({ supplier_category: updated });
}
