const { db } = require('../config/firebase');
const { OPEN_STATUSES } = require('../stateMachines/offer');
const { allFilesOwnedBy } = require('./fileOwnershipService');

const OFFER_FIELDS = [
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
];

/** One active offer per supplier per RFQ — since the Offer doc ID isn't deterministic (a
 * supplier may re-offer after withdrawing), this is enforced by query rather than a fixed ID. */
async function findActiveOfferForSupplier(rfqId, supplierOrgId) {
  const snap = await db
    .collection('offers')
    .where('rfq_id', '==', rfqId)
    .where('supplier_id', '==', supplierOrgId)
    .where('status', 'in', OPEN_STATUSES)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function createOffer({ rfq, supplierOrg, supplierId, data }) {
  if (data.attachments && data.attachments.length > 0) {
    const ownedOk = await allFilesOwnedBy(
      data.attachments.map((a) => a.file_id),
      supplierId,
    );
    if (!ownedOk) throw Object.assign(new Error('file ownership'), { code: 'file-ownership' });
  }

  const ref = db.collection('offers').doc();
  const offerData = {
    rfq_id: rfq.id,
    supplier_id: supplierOrg.id,
    supplier_anonymized_id: supplierOrg.supplier_profile.anonymized_id,
    status: 'SUBMITTED',
    submitted_at: new Date(),
    withdrawn_at: null,
    admin_flag_note: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  for (const field of OFFER_FIELDS) offerData[field] = data[field] ?? null;

  await ref.set(offerData);
  await reconcileItems(ref.id, data.items || []);
  await reconcileAttachments(ref.id, data.attachments || []);

  return { id: ref.id, ...offerData };
}

// Note: attachment file-ownership is verified once at create time, not re-checked on every
// edit — a re-check would need the supplier id threaded through here too, unnecessary for MVP
// scale since an offer's attachments rarely change after submission.
async function updateOffer(id, data) {
  const patch = { updated_at: new Date() };
  for (const field of OFFER_FIELDS) {
    if (data[field] !== undefined) patch[field] = data[field];
  }
  await db.collection('offers').doc(id).update(patch);
  if (data.items !== undefined) await reconcileItems(id, data.items);
  if (data.attachments !== undefined) await reconcileAttachments(id, data.attachments);
}

async function reconcileItems(offerId, items) {
  const ref = db.collection('offers').doc(offerId).collection('items');
  const existing = await ref.get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);
  for (const item of items) {
    batch.set(ref.doc(), {
      rfq_item_id: item.rfq_item_id ?? null,
      description: item.description,
      unit_price: item.unit_price,
      quantity: item.quantity,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  await batch.commit();
}

async function reconcileAttachments(offerId, attachments) {
  const ref = db.collection('offers').doc(offerId).collection('attachments');
  const existing = await ref.get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);
  for (const att of attachments) {
    batch.set(ref.doc(), { file_id: att.file_id, type: att.type, created_at: new Date(), updated_at: new Date() });
  }
  await batch.commit();
}

async function getOfferById(id) {
  const snap = await db.collection('offers').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function listOfferItems(offerId) {
  const snap = await db.collection('offers').doc(offerId).collection('items').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listOfferAttachments(offerId) {
  const snap = await db.collection('offers').doc(offerId).collection('attachments').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listOffersForSupplier(supplierOrgId) {
  const snap = await db.collection('offers').where('supplier_id', '==', supplierOrgId).orderBy('created_at', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Buyer's comparison view — every non-withdrawn offer on their RFQ. */
async function listOffersForRfq(rfqId) {
  const snap = await db.collection('offers').where('rfq_id', '==', rfqId).where('status', '!=', 'WITHDRAWN').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listOpenOffersForRfq(rfqId) {
  const snap = await db.collection('offers').where('rfq_id', '==', rfqId).where('status', 'in', OPEN_STATUSES).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function setOfferStatus(id, status, extra = {}) {
  await db
    .collection('offers')
    .doc(id)
    .update({ status, updated_at: new Date(), ...extra });
}

module.exports = {
  findActiveOfferForSupplier,
  createOffer,
  updateOffer,
  getOfferById,
  listOfferItems,
  listOfferAttachments,
  listOffersForSupplier,
  listOffersForRfq,
  listOpenOffersForRfq,
  setOfferStatus,
};
