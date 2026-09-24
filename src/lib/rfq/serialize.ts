import type { Rfq, RfqAttachment, RfqItem } from '@prisma/client';

type RfqWithRelations = Rfq & { items?: RfqItem[]; attachments?: RfqAttachment[]; category?: { name: string } | null };

export type RfqViewer = 'owner' | 'supplier' | 'admin';

/**
 * admin_notes is internal-only and never shown to buyer/supplier (SPEC.md Section 3 note on
 * rfqs.admin_notes). rejection_reason is shown to the buyer (Section 8.1) but has no bearing
 * on a supplier's view, since a supplier never sees a non-published RFQ anyway.
 */
export function serializeRfqForViewer(viewer: RfqViewer, rfq: RfqWithRelations) {
  const base = {
    id: rfq.id,
    category_id: rfq.category_id,
    category_name: rfq.category?.name ?? null,
    title: rfq.title,
    quantity: rfq.quantity,
    unit: rfq.unit,
    dimensions: rfq.dimensions,
    material: rfq.material,
    technical_specs: rfq.technical_specs,
    printing_customization: rfq.printing_customization,
    delivery_deadline: rfq.delivery_deadline,
    delivery_region: rfq.delivery_region,
    quality_requirements: rfq.quality_requirements,
    sample_required: rfq.sample_required,
    certifications_required: rfq.certifications_required,
    legal_compliance_requirements: rfq.legal_compliance_requirements,
    status: rfq.status,
    offer_deadline_at: rfq.offer_deadline_at,
    published_at: rfq.published_at,
    created_at: rfq.created_at,
    items: rfq.items?.map((i) => ({ id: i.id, item_name: i.item_name, quantity: i.quantity, unit: i.unit })),
    attachments: rfq.attachments?.map((a) => ({
      id: a.id,
      file_id: a.file_id,
      type: a.type,
      contains_identity_risk: a.contains_identity_risk,
    })),
  };

  if (viewer === 'supplier') {
    return base;
  }

  return {
    ...base,
    rejection_reason: rfq.rejection_reason,
    source_rfq_id: rfq.source_rfq_id,
    ...(viewer === 'admin' ? { admin_notes: rfq.admin_notes, buyer_id: rfq.buyer_id } : {}),
  };
}
