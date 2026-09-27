const { db } = require('../config/firebase');
const { resolveCategoryByName } = require('./categoryService');
const { allFilesOwnedBy } = require('./fileOwnershipService');
const { createWatermarkedPreview, getFileById } = require('./fileService');

const RFQ_FIELDS = [
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
  'offer_deadline_at',
];

function toDate(value) {
  return value ? new Date(value) : null;
}

/** Buyer identity is denormalized onto the RFQ doc from allowlisted, already masking-safe org
 * fields only (display_name/general_region) — legal_name never touches this doc at all, so a
 * supplier-facing read of an RFQ structurally cannot leak it (see plan's masking philosophy). */
async function createRfq({ buyerOrg, buyerId, data }) {
  const ref = db.collection('rfqs').doc();

  let category = null;
  if (data.category) category = await resolveCategoryByName(data.category);

  if (data.attachments && data.attachments.length > 0) {
    const ownedOk = await allFilesOwnedBy(
      data.attachments.map((a) => a.file_id),
      buyerId,
    );
    if (!ownedOk) throw Object.assign(new Error('file ownership'), { code: 'file-ownership' });
  }

  const rfqData = {
    buyer_id: buyerOrg.id,
    buyer_display_name: buyerOrg.display_name,
    buyer_general_region: buyerOrg.general_region,
    category_id: category ? category.id : null,
    category_name: category ? category.name : null,
    title: data.title,
    status: 'DRAFT',
    rejection_reason: null,
    admin_notes: null,
    published_at: null,
    source_rfq_id: data.source_rfq_id || null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  for (const field of RFQ_FIELDS) {
    rfqData[field] = field.endsWith('_at') || field === 'delivery_deadline' ? toDate(data[field]) : (data[field] ?? null);
  }

  await ref.set(rfqData);
  await reconcileItems(ref.id, data.items || []);
  await reconcileAttachments(ref.id, data.attachments || []);

  return { id: ref.id, ...rfqData };
}

async function updateRfq(id, data) {
  const patch = { updated_at: new Date() };
  if (data.title !== undefined) patch.title = data.title;
  if (data.category !== undefined) {
    const category = data.category ? await resolveCategoryByName(data.category) : null;
    patch.category_id = category ? category.id : null;
    patch.category_name = category ? category.name : null;
  }
  for (const field of RFQ_FIELDS) {
    if (data[field] !== undefined) {
      patch[field] = field.endsWith('_at') || field === 'delivery_deadline' ? toDate(data[field]) : data[field];
    }
  }

  await db.collection('rfqs').doc(id).update(patch);
  if (data.items !== undefined) await reconcileItems(id, data.items);
  if (data.attachments !== undefined) await reconcileAttachments(id, data.attachments);
}

/** Replace-all semantics — simpler and safer than diffing individual items for a form that
 * always submits its full current item/attachment list. */
async function reconcileItems(rfqId, items) {
  const ref = db.collection('rfqs').doc(rfqId).collection('items');
  const existing = await ref.get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);
  for (const item of items) {
    batch.set(ref.doc(), { item_name: item.item_name, quantity: item.quantity, unit: item.unit, created_at: new Date(), updated_at: new Date() });
  }
  await batch.commit();
}

async function reconcileAttachments(rfqId, attachments) {
  const ref = db.collection('rfqs').doc(rfqId).collection('attachments');
  const existing = await ref.get();
  const batch = db.batch();
  for (const doc of existing.docs) batch.delete(doc.ref);
  for (const att of attachments) {
    batch.set(ref.doc(), {
      file_id: att.file_id,
      type: att.type,
      contains_identity_risk: Boolean(att.contains_identity_risk),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  await batch.commit();

  // Generate the watermarked preview once per identity-risk attachment (SPEC.md Section 12) —
  // outside the batch since it involves Storage I/O, not just Firestore writes.
  for (const att of attachments) {
    if (!att.contains_identity_risk) continue;
    const file = await getFileById(att.file_id);
    if (file && !file.is_watermarked) await createWatermarkedPreview(file);
  }
}

async function getRfqById(id) {
  const snap = await db.collection('rfqs').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function listRfqItems(rfqId) {
  const snap = await db.collection('rfqs').doc(rfqId).collection('items').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listRfqAttachments(rfqId) {
  const snap = await db.collection('rfqs').doc(rfqId).collection('attachments').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function listRfqsForBuyer(buyerOrgId) {
  const snap = await db.collection('rfqs').where('buyer_id', '==', buyerOrgId).orderBy('created_at', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function setRfqStatus(id, status, extra = {}) {
  await db
    .collection('rfqs')
    .doc(id)
    .update({ status, updated_at: new Date(), ...extra });
}

module.exports = {
  createRfq,
  updateRfq,
  getRfqById,
  listRfqItems,
  listRfqAttachments,
  listRfqsForBuyer,
  setRfqStatus,
  reconcileItems,
  reconcileAttachments,
};
