import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { applyCategorySchema } from '@/lib/validation/category';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = applyCategorySchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const org = await prisma.organization.findFirst({
    where: { owner_user_id: auth.user.id, type: 'supplier' },
    include: { supplier_profile: true },
  });
  if (!org?.supplier_profile) return Errors.notFound();

  const category = await prisma.category.findUnique({ where: { id: parsed.data.category_id } });
  if (!category) return Errors.validation({ category_id: 'Category not found.' });

  const existing = await prisma.supplierCategory.findUnique({
    where: { supplier_id_category_id: { supplier_id: org.supplier_profile.id, category_id: category.id } },
  });
  if (existing) {
    return Errors.conflict(
      existing.approved
        ? 'You are already approved for this category.'
        : 'You already have a pending application for this category.',
    );
  }

  const created = await prisma.supplierCategory.create({
    data: {
      supplier_id: org.supplier_profile.id,
      category_id: category.id,
      production_capacity: parsed.data.production_capacity,
      materials_supported: parsed.data.materials_supported ?? [],
    },
  });

  await audit({
    actorId: auth.user.id,
    action: 'supplier_category.applied',
    entityType: 'supplier_category',
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ supplier_category: created }, { status: 201 });
}
