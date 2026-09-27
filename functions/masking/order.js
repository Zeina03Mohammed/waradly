const BASE_FIELDS = ['id', 'rfq_id', 'offer_id', 'buyer_id', 'supplier_id', 'status', 'sample_required', 'created_at', 'updated_at'];

function pick(order, fields) {
  const view = {};
  for (const f of fields) view[f] = order[f] ?? null;
  return view;
}

function serializeOrderFor(viewerRelation, order) {
  if (viewerRelation === 'admin') return pick(order, [...BASE_FIELDS, 'admin_notes']);
  return pick(order, BASE_FIELDS);
}

module.exports = { serializeOrderFor };
