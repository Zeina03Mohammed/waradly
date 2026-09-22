import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { toAdminOrganizationView, toPublicSupplierView } from '@/lib/masking/organization';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const supplier = await prisma.supplierProfile.findUnique({
    where: { id: params.id },
    include: { organization: true },
  });
  if (!supplier) return Errors.notFound();

  if (auth.user.role === 'admin') {
    return NextResponse.json({
      supplier: {
        ...toAdminOrganizationView(supplier.organization),
        anonymized_id: supplier.anonymized_id,
        verification_status: supplier.verification_status,
        completed_orders_count: supplier.completed_orders_count,
        average_rating: supplier.average_rating,
      },
    });
  }

  if (supplier.organization.owner_user_id === auth.user.id) {
    return NextResponse.json({
      supplier: {
        id: supplier.organization.id,
        legal_name: supplier.organization.legal_name,
        display_name: supplier.organization.display_name,
        country: supplier.organization.country,
        general_region: supplier.organization.general_region,
        exact_address: supplier.organization.exact_address,
        tax_id: supplier.organization.tax_id,
        logo_file_id: supplier.organization.logo_file_id,
        anonymized_id: supplier.anonymized_id,
        verification_status: supplier.verification_status,
        completed_orders_count: supplier.completed_orders_count,
        average_rating: supplier.average_rating,
      },
    });
  }

  // Counterpart: anonymized_id/score fields only (SPEC.md Section 16).
  return NextResponse.json({ supplier: toPublicSupplierView(supplier.organization, supplier) });
}
