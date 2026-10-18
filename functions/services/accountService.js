const { db, auth, bucket } = require('../config/firebase');
const { getOrganizationByOwner } = require('./organizationService');
const { listOrdersForBuyer, listOrdersForSupplier } = require('./orderService');
const { listRfqsForBuyer } = require('./rfqService');
const { listOffersForSupplier } = require('./offerService');
const { canTransitionRfq } = require('../stateMachines/rfq');
const { OPEN_STATUSES } = require('../stateMachines/offer');
const { audit } = require('./auditService');

// Orders here are over as far as the other party is concerned — anything else is still in flight.
const FINISHED_ORDER_STATUSES = ['DELIVERED', 'COMPLETED', 'CANCELLED'];

/** App Store / Play Store account deletion. Erases the person (login, profile, avatar, uploaded
 * files, verification docs, notifications) but keeps finished orders for the counterparty and
 * our records, with the organization anonymized as "Deleted account".
 * Returns { blocked: true } while the account still has orders in progress. */
async function deleteAccount(user) {
  const org = await getOrganizationByOwner(user.id);

  if (org) {
    const orders = org.type === 'buyer' ? await listOrdersForBuyer(org.id) : await listOrdersForSupplier(org.id);
    if (orders.some((o) => !FINISHED_ORDER_STATUSES.includes(o.status))) return { blocked: true };

    if (org.type === 'buyer') {
      for (const rfq of await listRfqsForBuyer(org.id)) {
        if (!canTransitionRfq(rfq.status, 'CANCELLED')) continue;
        await db.collection('rfqs').doc(rfq.id).update({ status: 'CANCELLED', updated_at: new Date() });
        const offers = await db.collection('offers').where('rfq_id', '==', rfq.id).where('status', 'in', OPEN_STATUSES).get();
        for (const offer of offers.docs) await offer.ref.update({ status: 'REJECTED', updated_at: new Date() });
      }
    } else {
      for (const offer of await listOffersForSupplier(org.id)) {
        if (OPEN_STATUSES.includes(offer.status)) await db.collection('offers').doc(offer.id).update({ status: 'WITHDRAWN', withdrawn_at: new Date(), updated_at: new Date() });
      }
    }

    const orgRef = db.collection('organizations').doc(org.id);
    await db.recursiveDelete(orgRef.collection('verification_documents'));
    await orgRef.update({ legal_name: 'Deleted account', display_name: null, exact_address: null, tax_id: null, logo_file_id: null, deleted_at: new Date(), updated_at: new Date() });
  }

  const files = await db.collection('files').where('uploader_id', '==', user.id).get();
  for (const doc of files.docs) {
    const { storage_key, preview_storage_key } = doc.data();
    for (const key of [storage_key, preview_storage_key]) if (key) await bucket.file(key).delete().catch(() => {});
    await doc.ref.update({ deleted_at: new Date(), storage_key: null, preview_storage_key: null, original_filename: null });
  }
  if (user.avatar_storage_key) await bucket.file(user.avatar_storage_key).delete().catch(() => {});

  await audit({ actorId: user.id, action: 'user.deleted', entityType: 'user', entityId: user.id, after: { organization_id: org?.id ?? null } });
  await db.recursiveDelete(db.collection('users').doc(user.id)); // doc + notifications + webauthn_credentials
  await auth.deleteUser(user.id);
  return { blocked: false };
}

module.exports = { deleteAccount, FINISHED_ORDER_STATUSES };
