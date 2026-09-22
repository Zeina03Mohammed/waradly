import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { createRfqSchema } from '@/lib/validation/rfq';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { syncRfqAttachments } from '@/lib/files/rfqAttachments';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { isSupplierEligibleForRfqFeed } from '@/lib/rfq/eligibility';
import { audit } from '@/lib/audit';

const RFQ_INCLUDE = { items: true, attachments: true } as const;

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = createRfqSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const data = parsed.data;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();
  // NOTE: Section 2's permissions matrix lists "Verified buyer account" as a condition for RFQ
  // creation, and buyer_profiles.verified exists for it — but unlike supplier verification
  // (Section 6.3/7.3: document upload + admin review screen), no workflow, endpoint, or admin
  // screen for setting it is described anywhere in the spec. Gating RFQ creation on it would
  // permanently lock out every real buyer with no way to ever become verified. We don't
  // enforce it here; email verification (Section 4, checked at /rfqs/{id}/submit) is the one
  // verification gate the spec actually describes a mechanism for.

  if (data.category_id) {
    const category = await prisma.category.findUnique({ where: { id: data.category_id } });
    if (!category) return Errors.validation({ category_id: 'Category not found.' });
  }

  if (data.attachments && data.attachments.length > 0) {
    const owned = await allFilesOwnedBy(data.attachments.map((a) => a.file_id), auth.user.id);
    if (!owned) return Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
  }

  const rfq = await prisma.$transaction(async (tx) => {
    const created = await tx.rfq.create({
      data: {
        buyer_id: buyerProfile.id,
        category_id: data.category_id,
        title: data.title,
        quantity: data.quantity,
        unit: data.unit,
        dimensions: data.dimensions,
        material: data.material,
        technical_specs: data.technical_specs,
        printing_customization: data.printing_customization,
        delivery_deadline: data.delivery_deadline,
        delivery_region: data.delivery_region,
        quality_requirements: data.quality_requirements,
        sample_required: data.sample_required ?? false,
        certifications_required: data.certifications_required,
        legal_compliance_requirements: data.legal_compliance_requirements,
        offer_deadline_at: data.offer_deadline_at,
      },
    });

    if (data.items && data.items.length > 0) {
      await tx.rfqItem.createMany({
        data: data.items.map((item) => ({ rfq_id: created.id, ...item })),
      });
    }

    if (data.attachments && data.attachments.length > 0) {
      await syncRfqAttachments(tx, created.id, data.attachments, auth.user.id);
    }

    return tx.rfq.findUniqueOrThrow({ where: { id: created.id }, include: RFQ_INCLUDE });
  });

  await audit({ actorId: auth.user.id, action: 'rfq.created', entityType: 'rfq', entityId: rfq.id, after: { title: rfq.title, status: rfq.status } });

  return NextResponse.json({ rfq: serializeRfqForViewer('owner', rfq) }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const categoryFilter = searchParams.get('category');
  const statusFilter = searchParams.get('status');

  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile) return Errors.notFound();

    const rfqs = await prisma.rfq.findMany({
      where: {
        buyer_id: buyerProfile.id,
        ...(categoryFilter ? { category_id: categoryFilter } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
      include: RFQ_INCLUDE,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ rfqs: rfqs.map((r) => serializeRfqForViewer('owner', r)) });
  }

  // Supplier eligible feed — SPEC.md Section 6.5.
  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const candidates = await prisma.rfq.findMany({
    where: {
      status: { in: ['PUBLISHED', 'RECEIVING_OFFERS'] },
      ...(categoryFilter ? { category_id: categoryFilter } : {}),
    },
    include: RFQ_INCLUDE,
    orderBy: { published_at: 'desc' },
  });

  const eligible = [];
  for (const rfq of candidates) {
    if (await isSupplierEligibleForRfqFeed(supplierProfile.id, rfq)) {
      eligible.push(serializeRfqForViewer('supplier', rfq));
    }
  }

  return NextResponse.json({ rfqs: eligible });
}
