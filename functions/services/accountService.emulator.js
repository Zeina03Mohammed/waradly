// Run against the emulators:
//   firebase emulators:exec --only firestore,auth "node --test functions/services/accountService.emulator.js"
process.env.FIREBASE_CONFIG ||= JSON.stringify({ projectId: 'waradly-1', storageBucket: 'waradly-1.appspot.com' });
process.env.GCLOUD_PROJECT ||= 'waradly-1';

const test = require('node:test');
const assert = require('node:assert');
const { db, auth } = require('../config/firebase');
const { deleteAccount } = require('./accountService');

async function seedBuyer(suffix, orderStatus) {
  const { uid } = await auth.createUser({ email: `del-${suffix}@test.com`, password: 'secret123' });
  await db.collection('users').doc(uid).set({ email: `del-${suffix}@test.com`, role: 'buyer', status: 'active', avatar_storage_key: null });
  await db.collection('users').doc(uid).collection('notifications').doc('n1').set({ read: false });
  await db.collection('organizations').doc(`org-${suffix}`).set({ owner_uid: uid, type: 'buyer', legal_name: 'Real Co', tax_id: '123', exact_address: 'Street 1', created_at: new Date() });
  await db.collection('orders').doc(`ord-${suffix}`).set({ buyer_id: `org-${suffix}`, supplier_id: 'sup', status: orderStatus });
  await db.collection('rfqs').doc(`rfq-${suffix}`).set({ buyer_id: `org-${suffix}`, status: 'RECEIVING_OFFERS', created_at: new Date() });
  await db.collection('offers').doc(`off-${suffix}`).set({ rfq_id: `rfq-${suffix}`, supplier_id: 'sup', status: 'SUBMITTED', created_at: new Date() });
  await db.collection('files').doc(`file-${suffix}`).set({ uploader_id: uid, storage_key: `files/${suffix}.pdf`, original_filename: 'id.pdf' });
  return { id: uid, avatar_storage_key: null };
}

const get = async (c, id) => (await db.collection(c).doc(id).get()).data();

test('blocks deletion while an order is in progress', async () => {
  const user = await seedBuyer('busy', 'PRODUCTION');
  assert.deepStrictEqual(await deleteAccount(user), { blocked: true });
  assert.strictEqual((await get('organizations', 'org-busy')).legal_name, 'Real Co');
  assert.ok(await auth.getUser(user.id));
});

test('erases the person, cancels open work, anonymizes the org', async () => {
  const user = await seedBuyer('done', 'COMPLETED');
  assert.deepStrictEqual(await deleteAccount(user), { blocked: false });

  const org = await get('organizations', 'org-done');
  assert.strictEqual(org.legal_name, 'Deleted account');
  assert.strictEqual(org.tax_id, null);
  assert.strictEqual(org.exact_address, null);
  assert.strictEqual((await get('rfqs', 'rfq-done')).status, 'CANCELLED');
  assert.strictEqual((await get('offers', 'off-done')).status, 'REJECTED');
  assert.strictEqual((await get('orders', 'ord-done')).status, 'COMPLETED'); // history kept
  assert.strictEqual((await get('files', 'file-done')).storage_key, null);
  assert.strictEqual(await get('users', user.id), undefined);
  assert.strictEqual((await db.collection('users').doc(user.id).collection('notifications').get()).size, 0);
  await assert.rejects(auth.getUser(user.id), /no user record/i);
});
