const { db, FieldValue } = require('../config/firebase');

function categoryApplicationsRef(orgId) {
  return db.collection('organizations').doc(orgId).collection('category_applications');
}

function verificationDocumentsRef(orgId) {
  return db.collection('organizations').doc(orgId).collection('verification_documents');
}

/** Doc ID = category id, reproducing the old @@unique([supplier_id, category_id]) for free. */
async function applyForCategory(orgId, { categoryId, productionCapacity, materialsSupported }) {
  const ref = categoryApplicationsRef(orgId).doc(categoryId);
  const existing = await ref.get();
  if (existing.exists) return null; // caller maps this to a conflict — already applied

  await ref.set({
    category_id: categoryId,
    approved: false,
    approved_at: null,
    production_capacity: productionCapacity ?? null,
    materials_supported: materialsSupported ?? [],
    created_at: new Date(),
    updated_at: new Date(),
  });
  return { id: categoryId };
}

async function listCategoryApplications(orgId) {
  const snap = await categoryApplicationsRef(orgId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Approves/revokes one category for a supplier — keeps organizations/{id}.approved_category_ids
 * (the denormalized array checked on every RFQ publish/offer submit, per the plan) in sync with
 * the subcollection doc in the same write. */
async function setCategoryApproval(orgId, categoryId, approved) {
  const appRef = categoryApplicationsRef(orgId).doc(categoryId);
  const orgRef = db.collection('organizations').doc(orgId);

  await db.runTransaction(async (tx) => {
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists) throw Object.assign(new Error('not found'), { code: 'not-found' });

    tx.update(appRef, { approved, approved_at: approved ? new Date() : null, updated_at: new Date() });
    tx.update(orgRef, {
      approved_category_ids: approved ? FieldValue.arrayUnion(categoryId) : FieldValue.arrayRemove(categoryId),
      updated_at: new Date(),
    });
  });
}

async function createVerificationDocument(orgId, { fileId, documentType }) {
  const ref = verificationDocumentsRef(orgId).doc();
  const data = {
    file_id: fileId,
    document_type: documentType,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

/** Admin's pending-review queue, across every supplier — same collection-group pattern as the
 * message-flags escalation queue described in the plan. */
async function listPendingVerifications() {
  const snap = await db.collectionGroup('verification_documents').where('status', '==', 'pending').get();
  return snap.docs.map((d) => ({ id: d.id, org_id: d.ref.parent.parent.id, ...d.data() }));
}

/** Bulk-approves/rejects every pending document for a supplier and flips the org-level
 * verification_status in one transaction — mirrors the old admin route's "approve the whole
 * supplier" behavior (SupplierProfile.verification_status + bulk SupplierVerification update). */
async function decideSupplierVerification(orgId, { status, rejectionReason, reviewerId }) {
  const orgRef = db.collection('organizations').doc(orgId);
  const pendingDocs = await verificationDocumentsRef(orgId).where('status', '==', 'pending').get();

  await db.runTransaction(async (tx) => {
    const orgSnap = await tx.get(orgRef);
    if (!orgSnap.exists) throw Object.assign(new Error('not found'), { code: 'not-found' });

    tx.update(orgRef, { 'supplier_profile.verification_status': status, updated_at: new Date() });
    for (const doc of pendingDocs.docs) {
      tx.update(doc.ref, {
        status,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        rejection_reason: status === 'rejected' ? rejectionReason ?? null : null,
        updated_at: new Date(),
      });
    }
  });
}

module.exports = {
  applyForCategory,
  listCategoryApplications,
  setCategoryApproval,
  createVerificationDocument,
  listPendingVerifications,
  decideSupplierVerification,
};
