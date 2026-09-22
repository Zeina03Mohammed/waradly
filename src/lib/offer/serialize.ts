import type { Offer, OfferAttachment } from '@prisma/client';
import { toPublicSupplierView, type OrganizationRecord, type SupplierProfileRecord } from '@/lib/masking/organization';

type OfferWithAttachments = Offer & { attachments?: OfferAttachment[] };

/** Buyer comparison view (SPEC.md Section 9.3) — supplier identity via the masked public view,
 * never legal_name/contact fields. */
export function serializeOfferForBuyer(
  offer: OfferWithAttachments,
  org: OrganizationRecord,
  supplier: SupplierProfileRecord,
) {
  return {
    id: offer.id,
    supplier: toPublicSupplierView(org, supplier),
    ...offerFields(offer),
  };
}

export function serializeOfferForSupplier(offer: OfferWithAttachments) {
  return {
    id: offer.id,
    rfq_id: offer.rfq_id,
    withdrawn_at: offer.withdrawn_at,
    ...offerFields(offer),
  };
}

function offerFields(offer: OfferWithAttachments) {
  return {
    unit_price: offer.unit_price,
    moq: offer.moq,
    production_lead_time_days: offer.production_lead_time_days,
    delivery_time_estimate_days: offer.delivery_time_estimate_days,
    shipping_estimate_notes: offer.shipping_estimate_notes,
    sample_availability: offer.sample_availability,
    sample_terms: offer.sample_terms,
    payment_terms: offer.payment_terms,
    technical_specs_notes: offer.technical_specs_notes,
    quality_notes: offer.quality_notes,
    status: offer.status,
    submitted_at: offer.submitted_at,
    attachments: offer.attachments?.map((a) => ({ id: a.id, file_id: a.file_id, type: a.type })),
  };
}
