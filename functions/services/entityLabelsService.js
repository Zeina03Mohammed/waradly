const { db } = require('../config/firebase');

const COLLECTION_BY_TYPE = { user: 'users', organization: 'organizations', rfq: 'rfqs', offer: 'offers', order: 'orders', file: 'files', dispute: 'disputes' };

function labelFor(entityType, data) {
  if (!data) return null;
  if (entityType === 'user') return data.email || data.username;
  if (entityType === 'organization') return data.legal_name || data.display_name;
  if (entityType === 'rfq') return data.title;
  if (entityType === 'offer') return `Offer ${data.supplier_anonymized_id || ''}`.trim();
  if (entityType === 'order') return `Order ${data.id || ''}`.trim();
  return null;
}

/** Port of src/lib/audit/entityLabels.ts — batches one get() per distinct (type, id) pair
 * instead of one per audit-log row, since a single admin audit-log page can reference the same
 * entity many times. */
async function attachEntityLabels(logs) {
  const byType = new Map();
  for (const log of logs) {
    if (!COLLECTION_BY_TYPE[log.entity_type]) continue;
    if (!byType.has(log.entity_type)) byType.set(log.entity_type, new Set());
    byType.get(log.entity_type).add(log.entity_id);
  }

  const labels = new Map(); // `${type}:${id}` -> label
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const docs = await Promise.all([...ids].map((id) => db.collection(COLLECTION_BY_TYPE[type]).doc(id).get()));
      for (const doc of docs) {
        if (doc.exists) labels.set(`${type}:${doc.id}`, labelFor(type, { id: doc.id, ...doc.data() }));
      }
    }),
  );

  return logs.map((log) => ({ ...log, entity_label: labels.get(`${log.entity_type}:${log.entity_id}`) ?? null }));
}

module.exports = { attachEntityLabels };
