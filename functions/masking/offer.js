/** Per-viewer Offer shaping. supplier_anonymized_id is denormalized onto the doc at creation
 * (masking-safe by construction — the buyer-facing view never needs a lookup that could
 * accidentally include the supplier's legal_name). */

const BASE_FIELDS = [
  'id',
  'rfq_id',
  'supplier_id',
  'supplier_anonymized_id',
  'unit_price',
  'moq',
  'production_lead_time_days',
  'delivery_time_estimate_days',
  'shipping_estimate_notes',
  'sample_availability',
  'sample_terms',
  'payment_terms',
  'technical_specs_notes',
  'quality_notes',
  'status',
  'submitted_at',
  'withdrawn_at',
  'created_at',
  'updated_at',
];

function pick(offer, fields) {
  const view = {};
  for (const f of fields) view[f] = offer[f] ?? null;
  return view;
}

function serializeOfferFor(viewerRelation, offer) {
  if (viewerRelation === 'admin') return pick(offer, [...BASE_FIELDS, 'admin_flag_note']);
  return pick(offer, BASE_FIELDS);
}

module.exports = { serializeOfferFor };
