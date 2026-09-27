const { db, FieldValue } = require('../config/firebase');

/** Port of src/lib/audit.ts — single writer for the append-only audit_logs collection.
 * Pass `tx` to fold the write into an existing Firestore transaction (e.g. the offer-accept
 * transaction in a later phase) instead of writing standalone. */
async function audit({ actorId = null, action, entityType, entityId, before = null, after = null }, tx = null) {
  const ref = db.collection('audit_logs').doc();
  const data = {
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_state: before,
    after_state: after,
    created_at: FieldValue.serverTimestamp(),
  };
  if (tx) {
    tx.set(ref, data);
  } else {
    await ref.set(data);
  }
  return ref.id;
}

async function listAuditLogsForEntity(entityType, entityId) {
  const snap = await db
    .collection('audit_logs')
    .where('entity_type', '==', entityType)
    .where('entity_id', '==', entityId)
    .orderBy('created_at', 'desc')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Port of src/app/api/admin/audit-logs's query support — actor/entity_type/date-range filters.
 * Firestore only allows range filters (the date bounds) on the same field as any orderBy, so
 * date filtering is combined with ordering by created_at; actor/entity_type stay as plain
 * equality filters on top. */
async function listAuditLogsFiltered({ actorId, entityType, from, to } = {}) {
  let query = db.collection('audit_logs');
  if (actorId) query = query.where('actor_id', '==', actorId);
  if (entityType) query = query.where('entity_type', '==', entityType);
  if (from) query = query.where('created_at', '>=', new Date(from));
  if (to) query = query.where('created_at', '<=', new Date(to));
  query = query.orderBy('created_at', 'desc').limit(200);

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

module.exports = { audit, listAuditLogsForEntity, listAuditLogsFiltered };
