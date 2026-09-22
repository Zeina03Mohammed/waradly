import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { serializeOfferForSupplier } from '@/lib/offer/serialize';

/** "My Offers" (SPEC.md Section 6.9) — not enumerated as its own row in Section 16's API
 * table, but the screen it backs is explicitly required, and this is the natural endpoint. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const statusFilter = request.nextUrl.searchParams.get('status');

  const offers = await prisma.offer.findMany({
    where: { supplier_id: supplierProfile.id, ...(statusFilter ? { status: statusFilter as never } : {}) },
    include: { attachments: true, rfq: { select: { title: true } } },
    orderBy: { submitted_at: 'desc' },
  });

  return NextResponse.json({
    offers: offers.map((o) => ({ ...serializeOfferForSupplier(o), rfq_title: o.rfq.title })),
  });
}
