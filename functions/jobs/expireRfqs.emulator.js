// Run against the Firestore emulator:
//   firebase emulators:exec --only firestore,auth "node --test functions/jobs/expireRfqs.emulator.js"
// (outside test/ and not *.test.js, so plain `npm test` skips it)
process.env.FIREBASE_CONFIG ||= JSON.stringify({ projectId: 'waradly-1', storageBucket: 'waradly-1.appspot.com' });
process.env.GCLOUD_PROJECT ||= 'waradly-1';

const test = require('node:test');
const assert = require('node:assert');
const { db } = require('../config/firebase');
const { expireRfqs } = require('../jobs/expireRfqs');

test('expires past-deadline RFQs and their open offers, leaves the rest', async () => {
  const past = new Date(Date.now() - 3600_000);
  const future = new Date(Date.now() + 3600_000);
  await db.collection('organizations').doc('t-buyer').set({ owner_uid: 't-buyer-user', type: 'buyer' });
  await db.collection('rfqs').doc('t-old').set({ status: 'RECEIVING_OFFERS', offer_deadline_at: past, buyer_id: 't-buyer', title: 'Old' });
  await db.collection('rfqs').doc('t-new').set({ status: 'PUBLISHED', offer_deadline_at: future, buyer_id: 't-buyer', title: 'New' });
  await db.collection('rfqs').doc('t-awarded').set({ status: 'RECEIVING_OFFERS', offer_deadline_at: past, buyer_id: 't-buyer', title: 'Awarded' });
  await db.collection('orders').doc('t-awarded').set({ rfq_id: 't-awarded' }); // accepted concurrently
  await db.collection('offers').doc('t-open').set({ rfq_id: 't-old', status: 'SUBMITTED' });
  await db.collection('offers').doc('t-withdrawn').set({ rfq_id: 't-old', status: 'WITHDRAWN' });

  assert.strictEqual(await expireRfqs(), 1);

  const status = async (c, id) => (await db.collection(c).doc(id).get()).data().status;
  assert.strictEqual(await status('rfqs', 't-old'), 'EXPIRED');
  assert.strictEqual(await status('rfqs', 't-new'), 'PUBLISHED');
  assert.strictEqual(await status('rfqs', 't-awarded'), 'RECEIVING_OFFERS');
  assert.strictEqual(await status('offers', 't-open'), 'EXPIRED');
  assert.strictEqual(await status('offers', 't-withdrawn'), 'WITHDRAWN');
  assert.strictEqual(await expireRfqs(), 0); // idempotent
});
