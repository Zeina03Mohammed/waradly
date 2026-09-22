import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { rfqFieldsSchema } from '@/lib/validation/rfq';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { syncRfqAttachments } from '@/lib/files/rfqAttachments';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { isSupplierEligibleForRfqFeed } from '@/lib/rfq/eligibility';
import { audit } from '@/lib/audit';

const RFQ_INCLUDE = { items: true, attachments: true } as const;
const EDITABLE_STATUSES = ['DRAFT', 'SUBMITTED'];

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: RFQ_INCLUDE });
  if (!rfq) return Errors.notFound();

  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();
    return NextResponse.json({ rfq: serializeRfqForViewer('owner', rfq) });
  }

  if (auth.user.role === 'admin') {
    let current = rfq;
    // "UNDER_REVIEW ... Admin (auto on opening review)" — SPEC.md Section 8.1.
    if (rfq.status === 'SUBMITTED') {
      current = await prisma.rfq.update({ where: { id: rfq.id }, data: { status: 'UNDER_REVIEW' }, include: RFQ_INCLUDE });
      await audit({
        actorId: auth.user.id,
        action: 'rfq.review_opened',
        entityType: 'rfq',
        entityId: rfq.id,
        before: { status: 'SUBMITTED' },
        after: { status: 'UNDER_REVIEW' },
      });
    }
    return NextResponse.json({ rfq: serializeRfqForViewer('admin', current) });
  }

  // Supplier
  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const isPublished = rfq.status === 'PUBLISHED' || rfq.status === 'RECEIVING_OFFERS';
  const eligible = isPublished && (await isSupplierEligibleForRfqFeed(supplierProfile.id, rfq));
  if (!eligible) return Errors.notFound();

  return NextResponse.json({ rfq: serializeRfqForViewer('supplier', rfq) });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id }, include: RFQ_INCLUDE });
  if (!rfq || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();

  if (!EDITABLE_STATUSES.includes(rfq.status)) {
    return errorResponse(403, 'FORBIDDEN', 'This RFQ can no longer be edited — cancel it and create a new one instead.');
  }

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = rfqFieldsSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const data = parsed.data;

  if (data.category_id) {
    const category = await prisma.category.findUnique({ where: { id: data.category_id } });
    if (!category) return Errors.validation({ category_id: 'Category not found.' });
  }
  if (data.attachments) {
    const owned = await allFilesOwnedBy(data.attachments.map((a) => a.file_id), auth.user.id);
    if (!owned) return Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
  }

  const before = serializeRfqForViewer('owner', rfq);

  const updated = await prisma.$transaction(async (tx) => {
    const { attachments, items, ...fields } = data;
    await tx.rfq.update({ where: { id: rfq.id }, data: fields });

    if (items) {
      await tx.rfqItem.deleteMany({ where: { rfq_id: rfq.id } });
      if (items.length > 0) {
        await tx.rfqItem.createMany({ data: items.map((item) => ({ rfq_id: rfq.id, ...item })) });
      }
    }
    if (attachments) {
      await syncRfqAttachments(tx, rfq.id, attachments, auth.user.id);
    }

    return tx.rfq.findUniqueOrThrow({ where: { id: rfq.id }, include: RFQ_INCLUDE });
  });

  const after = serializeRfqForViewer('owner', updated);
  await audit({ actorId: auth.user.id, action: 'rfq.updated', entityType: 'rfq', entityId: rfq.id, before, after });

  return NextResponse.json({ rfq: after });
}
