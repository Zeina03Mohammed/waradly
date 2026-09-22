import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { toAdminOrganizationView, toPublicOrganizationView, toPublicSupplierView, toSelfOrganizationView } from '@/lib/masking/organization';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const org = await prisma.organization.findUnique({ where: { id: params.id } });
  if (!org) return Errors.notFound();

  if (auth.user.role === 'admin') {
    return NextResponse.json({ organization: toAdminOrganizationView(org) });
  }

  if (org.owner_user_id === auth.user.id) {
    return NextResponse.json({ organization: toSelfOrganizationView(org) });
  }

  // Counterpart: always the masked view (SPEC.md Section 11).
  if (org.type === 'supplier') {
    const supplierProfile = await prisma.supplierProfile.findUnique({ where: { organization_id: org.id } });
    if (!supplierProfile) return Errors.notFound();
    return NextResponse.json({ organization: toPublicSupplierView(org, supplierProfile) });
  }

  return NextResponse.json({ organization: toPublicOrganizationView(org) });
}
