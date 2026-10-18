const { db } = require('../config/firebase');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notifyService');
const { getOrganizationById } = require('../services/organizationService');
const { OPEN_STATUSES } = require('../stateMachines/offer');

const EXPIRABLE = ['PUBLISHED', 'RECEIVING_OFFERS'];

/** SPEC.md Section 8.1 / 9.2 — RFQs past offer_deadline_at with no accepted offer become EXPIRED,
 * along with their still-open offers. Port of scripts/expire-rfqs.ts. Each RFQ is re-checked
 * inside its own transaction so a buyer accepting an offer at the same moment wins cleanly. */
async function expireRfqs(now = new Date()) {
  const snap = await db.collection('rfqs').where('status', 'in', EXPIRABLE).where('offer_deadline_at', '<', now).get();

  let expired = 0;
  for (const doc of snap.docs) {
    const offersSnap = await db.collection('offers').where('rfq_id', '==', doc.id).where('status', 'in', OPEN_STATUSES).get();

    const didExpire = await db.runTransaction(async (tx) => {
      const [rfqSnap, orderSnap] = await Promise.all([tx.get(doc.ref), tx.get(db.collection('orders').doc(doc.id))]);
      if (!EXPIRABLE.includes(rfqSnap.data().status) || orderSnap.exists) return false;

      tx.update(doc.ref, { status: 'EXPIRED', updated_at: new Date() });
      for (const offer of offersSnap.docs) tx.update(offer.ref, { status: 'EXPIRED', updated_at: new Date() });
      await audit({ action: 'rfq.expired', entityType: 'rfq', entityId: doc.id, before: { status: rfqSnap.data().status }, after: { status: 'EXPIRED' } }, tx);
      return true;
    });
    if (!didExpire) continue;
    expired++;

    const rfq = doc.data();
    const buyerOrg = await getOrganizationById(rfq.buyer_id);
    if (buyerOrg) {
      await notify({ userId: buyerOrg.owner_uid, eventType: 'rfq.expired', message: `Your RFQ "${rfq.title}" expired with no offer accepted.`, link: `/buyer/rfqs/${doc.id}` });
    }
  }

  console.log(`[expireRfqs] expired ${expired} of ${snap.size} candidate RFQ(s)`);
  return expired;
}

module.exports = { expireRfqs };
