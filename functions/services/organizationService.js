const { db } = require('../config/firebase');
const { generateAnonymizedId } = require('./anonymizedIdService');

/** Creates the organization doc with the buyer/supplier profile embedded as a map (see plan:
 * BuyerProfile/SupplierProfile are a true 1:1-cascade case, so no separate collection). */
async function createOrganization({ ownerUid, type, legalName, country, generalRegion }) {
  const ref = db.collection('organizations').doc();
  const base = {
    owner_uid: ownerUid,
    type,
    legal_name: legalName,
    display_name: null,
    country,
    general_region: generalRegion,
    exact_address: null,
    tax_id: null,
    logo_file_id: null,
    approved_category_ids: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (type === 'buyer') {
    base.buyer_profile = { verified: false };
  } else {
    base.supplier_profile = {
      anonymized_id: await generateAnonymizedId(),
      verification_status: 'pending',
      completed_orders_count: 0,
      rating_sum: 0,
      rating_count: 0,
    };
  }

  await ref.set(base);
  return { id: ref.id, ...base };
}

async function getOrganizationById(id) {
  const snap = await db.collection('organizations').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getOrganizationByOwner(ownerUid) {
  const snap = await db.collection('organizations').where('owner_uid', '==', ownerUid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function updateOrganization(id, patch) {
  await db
    .collection('organizations')
    .doc(id)
    .update({ ...patch, updated_at: new Date() });
}

module.exports = { createOrganization, getOrganizationById, getOrganizationByOwner, updateOrganization };
