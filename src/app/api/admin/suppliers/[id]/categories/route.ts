import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

/** Backs the Supplier Capability Management screen (SPEC.md Section 7.5). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const categories = await prisma.supplierCategory.findMany({
    where: { supplier_id: params.id },
    include: { category: true },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      category_id: c.category_id,
      category_name: c.category.name,
      production_capacity: c.production_capacity,
      materials_supported: c.materials_supported,
      approved: c.approved,
      approved_at: c.approved_at,
    })),
  });
}
