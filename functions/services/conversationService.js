const { db } = require('../config/firebase');

function rfqConversationId(rfqId, supplierOrgId) {
  return `rfq_${rfqId}_supplier_${supplierOrgId}`;
}
function orderConversationId(orderId) {
  return `order_${orderId}`;
}

/** Deterministic doc IDs reproduce the old @@unique([rfq_id, supplier_id]) with no transaction
 * needed — find-or-create is just a get-then-maybe-set on a known id. */
async function findOrCreateRfqConversation({ rfq, buyerOrgId, supplierOrgId }) {
  const id = rfqConversationId(rfq.id, supplierOrgId);
  const ref = db.collection('conversations').doc(id);
  const snap = await ref.get();
  if (snap.exists) return { id, ...snap.data() };

  const data = { rfq_id: rfq.id, order_id: null, buyer_id: buyerOrgId, supplier_id: supplierOrgId, created_at: new Date(), updated_at: new Date() };
  await ref.set(data);
  return { id, ...data };
}

async function findOrCreateOrderConversation({ order }) {
  const id = orderConversationId(order.id);
  const ref = db.collection('conversations').doc(id);
  const snap = await ref.get();
  if (snap.exists) return { id, ...snap.data() };

  const data = { rfq_id: null, order_id: order.id, buyer_id: order.buyer_id, supplier_id: order.supplier_id, created_at: new Date(), updated_at: new Date() };
  await ref.set(data);
  return { id, ...data };
}

async function getConversationById(id) {
  const snap = await db.collection('conversations').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function listConversationsForOrg(orgId, role) {
  const field = role === 'buyer' ? 'buyer_id' : 'supplier_id';
  const snap = await db.collection('conversations').where(field, '==', orgId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { findOrCreateRfqConversation, findOrCreateOrderConversation, getConversationById, listConversationsForOrg };
