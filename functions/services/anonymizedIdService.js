const { db } = require('../config/firebase');

/** Port of src/lib/anonymizedId.ts. Prisma used a DB-level unique-retry loop; Firestore has no
 * auto-increment, so this uses a single counter doc read-then-written inside a transaction —
 * Firestore retries the whole transaction on a concurrent write to counterRef, so this is
 * atomic and race-safe without a manual retry loop. */
async function generateAnonymizedId() {
  const counterRef = db.collection('counters').doc('supplier_anonymized_id');
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const value = (snap.exists ? snap.data().value : 0) + 1;
    tx.set(counterRef, { value });
    return value;
  });
  return `Supplier #${String(next).padStart(4, '0')}`;
}

module.exports = { generateAnonymizedId };
