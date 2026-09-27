const { db, FieldValue, auth } = require('../config/firebase');
const { sendEmail } = require('./emailChannelService');

/** Port of src/lib/notifications/notify.ts. In-app is always written; email is opt-in per call
 * (`email: {subject, body}` — `to` is resolved automatically from the recipient's uid via
 * Firebase Auth, so callers never need to look up an address themselves) and reserved for the
 * "High priority" events SPEC.md Section 14 lists (order/offer/RFQ/verification/dispute
 * decisions) — most call sites are in-app only by design, not an oversight. */
async function notify({ userId, eventType, message, link = null, email = null }) {
  await db.collection('users').doc(userId).collection('notifications').add({
    event_type: eventType,
    channel: 'in_app',
    message,
    link,
    read: false,
    sent_at: FieldValue.serverTimestamp(),
  });

  if (email) {
    const user = await auth.getUser(userId).catch(() => null);
    if (user?.email) await sendEmail({ to: user.email, subject: email.subject, body: email.body });
  }
}

async function listNotifications(userId) {
  const snap = await db.collection('users').doc(userId).collection('notifications').orderBy('sent_at', 'desc').limit(100).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function markNotificationRead(userId, notificationId) {
  const ref = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ read: true });
  return true;
}

async function markAllNotificationsRead(userId) {
  const snap = await db.collection('users').doc(userId).collection('notifications').where('read', '==', false).get();
  const batch = db.batch();
  for (const doc of snap.docs) batch.update(doc.ref, { read: true });
  await batch.commit();
}

module.exports = { notify, listNotifications, markNotificationRead, markAllNotificationsRead };
