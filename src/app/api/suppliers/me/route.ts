import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { toSelfOrganizationView } from '@/lib/masking/organization';
import { prisma } from '@/lib/prisma';

/** Convenience self-lookup so the supplier's own screens don't need to already know their
 * supplier_profile id — mirrors the pattern of /organizations/me. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const org = await prisma.organization.findUnique({ where: { id: supplierProfile.organization_id } });
  if (!org) return Errors.notFound();

  return NextResponse.json({
    supplier: {
      id: supplierProfile.id,
      anonymized_id: supplierProfile.anonymized_id,
      verification_status: supplierProfile.verification_status,
      completed_orders_count: supplierProfile.completed_orders_count,
      average_rating: supplierProfile.average_rating,
      organization: toSelfOrganizationView(org),
    },
  });
}
