/** Per-viewer RFQ shaping. Buyer identity fields on the doc (buyer_display_name/
 * buyer_general_region) are already masking-safe by construction (see rfqService.createRfq),
 * so no extra masking is needed there — this only hides admin-internal fields from non-admins. */

const BASE_FIELDS = [
  'id',
  'buyer_id',
  'buyer_display_name',
  'buyer_general_region',
  'category_id',
  'category_name',
  'title',
  'quantity',
  'unit',
  'dimensions',
  'material',
  'technical_specs',
  'printing_customization',
  'delivery_deadline',
  'delivery_region',
  'quality_requirements',
  'sample_required',
  'certifications_required',
  'legal_compliance_requirements',
  'status',
  'offer_deadline_at',
  'published_at',
  'source_rfq_id',
  'created_at',
  'updated_at',
];

function pick(rfq, fields) {
  const view = {};
  for (const f of fields) view[f] = rfq[f] ?? null;
  return view;
}

function serializeRfqFor(viewerRelation, rfq) {
  if (viewerRelation === 'admin' || viewerRelation === 'owner') {
    return pick(rfq, [...BASE_FIELDS, 'rejection_reason', 'admin_notes']);
  }
  // 'supplier' — pre-publish fields (rejection_reason) are never relevant, since suppliers only
  // ever see PUBLISHED/RECEIVING_OFFERS RFQs.
  return pick(rfq, BASE_FIELDS);
}

module.exports = { serializeRfqFor };
