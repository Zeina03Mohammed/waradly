import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { createOfferSchema } from '@/lib/validation/offer';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { serializeOfferForBuyer, serializeOfferForSupplier } from '@/lib/offer/serialize';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const OFFER_INCLUDE = { attachments: true } as const;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  if (!auth.user.email_verified_at) {
    return errorResponse(403, 'FORBIDDEN', 'Verify your email before submitting an offer.');
  }

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq) return Errors.notFound();

  if (rfq.status !== 'PUBLISHED' && rfq.status !== 'RECEIVING_OFFERS') {
    return errorResponse(403, 'FORBIDDEN', 'This RFQ is no longer accepting offers.');
  }
  if (!rfq.offer_deadline_at || rfq.offer_deadline_at < new Date()) {
    return errorResponse(403, 'FORBIDDEN', 'This RFQ is no longer accepting offers.');
  }
  if (!rfq.category_id) return Errors.notFound();

  const approval = await prisma.supplierCategory.findUnique({
    where: { supplier_id_category_id: { supplier_id: supplierProfile.id, category_id: rfq.category_id } },
  });
  if (!approval?.approved) return Errors.forbidden();

  const existing = await prisma.offer.findUnique({
    where: { rfq_id_supplier_id: { rfq_id: rfq.id, supplier_id: supplierProfile.id } },
  });
  if (existing) {
    return Errors.conflict('You already submitted an offer on this RFQ — edit your existing offer instead.');
  }

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = createOfferSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const data = parsed.data;

  if (data.attachments && data.attachments.length > 0) {
    const owned = await allFilesOwnedBy(data.attachments.map((a) => a.file_id), auth.user.id);
    if (!owned) return Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
  }

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        rfq_id: rfq.id,
        supplier_id: supplierProfile.id,
        unit_price: data.unit_price,
        moq: data.moq,
        production_lead_time_days: data.production_lead_time_days,
        delivery_time_estimate_days: data.delivery_time_estimate_days,
        shipping_estimate_notes: data.shipping_estimate_notes,
        sample_availability: data.sample_availability,
        sample_terms: data.sample_terms,
        payment_terms: data.payment_terms,
        technical_specs_notes: data.technical_specs_notes,
        quality_notes: data.quality_notes,
      },
    });

    if (data.attachments && data.attachments.length > 0) {
      await tx.offerAttachment.createMany({
        data: data.attachments.map((a) => ({ offer_id: created.id, file_id: a.file_id, type: a.type })),
      });
    }

    // "RECEIVING_OFFERS System (auto on first offer received)" — SPEC.md Section 8.1.
    if (rfq.status === 'PUBLISHED') {
      await tx.rfq.update({ where: { id: rfq.id }, data: { status: 'RECEIVING_OFFERS' } });
    }

    return tx.offer.findUniqueOrThrow({ where: { id: created.id }, include: OFFER_INCLUDE });
  });

  await audit({
    actorId: auth.user.id,
    action: 'offer.created',
    entityType: 'offer',
    entityId: offer.id,
    after: { rfq_id: rfq.id, status: offer.status },
  });

  const buyer = await prisma.buyerProfile.findUnique({ where: { id: rfq.buyer_id }, include: { organization: true } });
  if (buyer) {
    const buyerOwner = await prisma.user.findUnique({ where: { id: buyer.organization.owner_user_id } });
    if (buyerOwner) {
      await notify({
        userId: buyerOwner.id,
        eventType: 'offer.submitted',
        message: `A new offer was submitted on your RFQ "${rfq.title}".`,
        link: `/buyer/rfqs/${rfq.id}/offers`,
        email: {
          to: buyerOwner.email,
          subject: 'New offer on your Waradly RFQ',
          body: `A supplier submitted a new offer on your RFQ "${rfq.title}". Log in to compare offers.`,
        },
      });
    }
  }

  return NextResponse.json({ offer: serializeOfferForSupplier(offer) }, { status: 201 });
}

/** Buyer comparison view — SPEC.md Section 5.8/9.3. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();

  const offers = await prisma.offer.findMany({
    where: { rfq_id: rfq.id, status: { not: 'WITHDRAWN' } },
    include: { ...OFFER_INCLUDE, supplier: { include: { organization: true } } },
    orderBy: { submitted_at: 'asc' },
  });

  return NextResponse.json({
    offers: offers.map((o) => serializeOfferForBuyer(o, o.supplier.organization, o.supplier)),
  });
}
