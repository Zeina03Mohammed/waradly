const { db } = require('../config/firebase');

/** Port of src/lib/rfq/eligibility.ts. Default rule: a supplier sees an RFQ if they're approved
 * for its category. Admin can override per-RFQ via distribution_overrides — an explicit
 * included:false excludes even an approved supplier, an explicit included:true includes even an
 * unapproved one. */
async function isSupplierEligibleForRfqFeed(rfq, supplierOrg) {
  if (!['PUBLISHED', 'RECEIVING_OFFERS'].includes(rfq.status)) return false;

  const overrideSnap = await db
    .collection('rfqs')
    .doc(rfq.id)
    .collection('distribution_overrides')
    .doc(supplierOrg.id)
    .get();
  if (overrideSnap.exists) return Boolean(overrideSnap.data().included);

  return (supplierOrg.approved_category_ids || []).includes(rfq.category_id);
}

/** For the buyer-side RFQ feed (GET /rfqs), given a supplier org, returns every PUBLISHED/
 * RECEIVING_OFFERS RFQ they're eligible to see. Firestore's `in` operator caps at 10 values and
 * combining two `in`/range filters on different fields needs a composite index, so this filters
 * by category_id `in` (...) only and checks status in memory — cheap at this scale (a supplier's
 * approved-category list is small, and so is the resulting candidate set). Per-RFQ distribution
 * overrides are then applied the same way isSupplierEligibleForRfqFeed does, one doc read per
 * candidate — still cheap, since the candidate set is already narrowed by category. */
async function listEligibleRfqsForSupplier(supplierOrg) {
  const categoryIds = (supplierOrg.approved_category_ids || []).slice(0, 10);
  if (categoryIds.length === 0) return [];

  const snap = await db.collection('rfqs').where('category_id', 'in', categoryIds).get();
  const candidates = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((rfq) => ['PUBLISHED', 'RECEIVING_OFFERS'].includes(rfq.status));

  const eligible = [];
  for (const rfq of candidates) {
    const override = await db.collection('rfqs').doc(rfq.id).collection('distribution_overrides').doc(supplierOrg.id).get();
    if (override.exists ? Boolean(override.data().included) : true) eligible.push(rfq);
  }
  return eligible;
}

async function getApprovedSupplierIdsForCategory(categoryId) {
  const snap = await db.collection('organizations').where('approved_category_ids', 'array-contains', categoryId).get();
  return snap.docs.map((d) => d.id);
}

module.exports = { isSupplierEligibleForRfqFeed, listEligibleRfqsForSupplier, getApprovedSupplierIdsForCategory };
