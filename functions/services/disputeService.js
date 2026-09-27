const { db } = require('../config/firebase');

async function createDispute({ orderId, raisedBy, category, description }) {
  const ref = db.collection('disputes').doc();
  const data = {
    order_id: orderId,
    raised_by: raisedBy,
    category,
    description,
    status: 'open',
    resolution_outcome: null,
    resolution_notes: null,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

async function getDisputeById(id) {
  const snap = await db.collection('disputes').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function listDisputes(status) {
  let query = db.collection('disputes');
  if (status) query = query.where('status', '==', status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function resolveDispute(id, { outcome, notes, resolvedBy }) {
  await db.collection('disputes').doc(id).update({
    status: 'resolved',
    resolution_outcome: outcome,
    resolution_notes: notes ?? null,
    resolved_by: resolvedBy,
    resolved_at: new Date(),
    updated_at: new Date(),
  });
}

module.exports = { createDispute, getDisputeById, listDisputes, resolveDispute };
