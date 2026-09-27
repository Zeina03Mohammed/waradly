const { db, FieldValue } = require('../config/firebase');
const { setRfqStatus } = require('./rfqService');

async function getOrderById(id) {
  const snap = await db.collection('orders').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function listOrderStatusHistory(orderId) {
  const snap = await db.collection('orders').doc(orderId).collection('status_history').orderBy('changed_at', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function addStatusHistory(orderId, { fromStatus, toStatus, changedBy, evidenceFileId = null, note = null }, tx = null) {
  const ref = db.collection('orders').doc(orderId).collection('status_history').doc();
  const data = { from_status: fromStatus, to_status: toStatus, changed_by: changedBy, evidence_file_id: evidenceFileId, note, changed_at: new Date() };
  if (tx) tx.set(ref, data);
  else await ref.set(data);
}

async function setOrderStatus(orderId, status, { changedBy, evidenceFileId, note, extra = {} } = {}) {
  const orderRef = db.collection('orders').doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) throw Object.assign(new Error('not found'), { code: 'not-found' });
    const fromStatus = snap.data().status;
    tx.update(orderRef, { status, updated_at: new Date(), ...extra });
    await addStatusHistory(orderId, { fromStatus, toStatus: status, changedBy, evidenceFileId, note }, tx);
  });
}

async function listOrdersForBuyer(buyerOrgId) {
  const snap = await db.collection('orders').where('buyer_id', '==', buyerOrgId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listOrdersForSupplier(supplierOrgId) {
  const snap = await db.collection('orders').where('supplier_id', '==', supplierOrgId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Port of src/lib/order/completion.ts — shared "order reached COMPLETED" side effects: close
 * the linked RFQ and bump the supplier's completed-orders counter. Called from both the
 * buyer-rating route and the admin generic-status route, same as the original. */
async function applyOrderCompletionSideEffects(order) {
  await setRfqStatus(order.rfq_id, 'CLOSED');
  await db
    .collection('organizations')
    .doc(order.supplier_id)
    .update({ 'supplier_profile.completed_orders_count': FieldValue.increment(1), updated_at: new Date() });
}

module.exports = {
  getOrderById,
  listOrderStatusHistory,
  addStatusHistory,
  setOrderStatus,
  listOrdersForBuyer,
  listOrdersForSupplier,
  applyOrderCompletionSideEffects,
};
