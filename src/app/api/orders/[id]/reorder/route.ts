import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { audit } from '@/lib/audit';

/** SPEC.md Section 5.12 — pre-fills a new DRAFT RFQ from a completed order's original RFQ;
 * the buyer can edit any field before submitting, and it works across categories. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { rfq: { include: { items: true, attachments: true } } } });
  if (!order || order.buyer_id !== buyerProfile.id) return Errors.notFound();
  if (order.status !== 'COMPLETED') return Errors.forbidden();

  const source = order.rfq;

  const newRfq = await prisma.$transaction(async (tx) => {
    const created = await tx.rfq.create({
      data: {
        buyer_id: buyerProfile.id,
        category_id: source.category_id,
        title: source.title,
        quantity: source.quantity,
        unit: source.unit,
        dimensions: source.dimensions,
        material: source.material,
        technical_specs: source.technical_specs ?? undefined,
        printing_customization: source.printing_customization,
        delivery_deadline: null,
        delivery_region: source.delivery_region,
        quality_requirements: source.quality_requirements,
        sample_required: source.sample_required,
        certifications_required: source.certifications_required,
        legal_compliance_requirements: source.legal_compliance_requirements,
        offer_deadline_at: null,
        source_rfq_id: source.id,
      },
    });

    if (source.items.length > 0) {
      await tx.rfqItem.createMany({
        data: source.items.map((item) => ({ rfq_id: created.id, item_name: item.item_name, quantity: item.quantity, unit: item.unit })),
      });
    }

    return tx.rfq.findUniqueOrThrow({ where: { id: created.id }, include: { items: true, attachments: true } });
  });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.created_from_reorder',
    entityType: 'rfq',
    entityId: newRfq.id,
    after: { source_order_id: order.id, source_rfq_id: source.id },
  });

  return NextResponse.json({ rfq: serializeRfqForViewer('owner', newRfq) }, { status: 201 });
}
