const { db } = require('../config/firebase');

async function createCategory(name) {
  const existing = await db.collection('categories').where('name', '==', name).limit(1).get();
  if (!existing.empty) return null; // caller maps this to a conflict

  const ref = db.collection('categories').doc();
  const data = { name, status: 'coming_soon', phase: 1, created_at: new Date(), updated_at: new Date() };
  await ref.set(data);
  return { id: ref.id, ...data };
}

async function listCategories() {
  const snap = await db.collection('categories').orderBy('name').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getCategoryById(id) {
  const snap = await db.collection('categories').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function setCategoryStatus(id, status) {
  await db.collection('categories').doc(id).update({ status, updated_at: new Date() });
}

/** Only deletable if no RFQ or supplier references it — RFQs don't exist until phase 5, so for
 * now this only checks supplier category applications (collection-group across every org). */
async function isCategoryInUse(id) {
  const apps = await db.collectionGroup('category_applications').where('category_id', '==', id).limit(1).get();
  return !apps.empty;
}

async function deleteCategory(id) {
  await db.collection('categories').doc(id).delete();
}

/** Port of src/lib/rfq/resolveCategory.ts — resolves a buyer's free-text category name to a
 * real Category doc, creating one (status: coming_soon, same default as an admin-created one)
 * if it doesn't exist yet. Race-safe via a transaction: two buyers typing the same new category
 * name at once still end up with exactly one category doc, not two. */
async function resolveCategoryByName(name) {
  const trimmed = name.trim();
  const existing = await db.collection('categories').where('name', '==', trimmed).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return db.runTransaction(async (tx) => {
    // Re-check inside the transaction — the query above ran outside it, so a concurrent
    // create between that read and here is still possible without this second check.
    const recheck = await tx.get(db.collection('categories').where('name', '==', trimmed).limit(1));
    if (!recheck.empty) {
      const doc = recheck.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    const ref = db.collection('categories').doc();
    const data = { name: trimmed, status: 'coming_soon', phase: 1, created_at: new Date(), updated_at: new Date() };
    tx.set(ref, data);
    return { id: ref.id, ...data };
  });
}

module.exports = {
  createCategory,
  listCategories,
  getCategoryById,
  setCategoryStatus,
  isCategoryInUse,
  deleteCategory,
  resolveCategoryByName,
};
