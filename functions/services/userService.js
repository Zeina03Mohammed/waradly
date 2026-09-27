const { db } = require('../config/firebase');

async function createUserDoc(uid, { email, phone, username, role }) {
  const data = {
    email,
    phone: phone ?? null,
    username: username ?? null,
    avatar_storage_key: null,
    avatar_mime_type: null,
    role,
    status: 'active',
    status_reason: null,
    // Mirrors Firebase Auth's own emailVerified flag — Firebase Auth is the source of truth
    // (checked on every login), this copy exists only so the self-view doesn't need an extra
    // Admin SDK call on every request. Kept in sync at the one place it changes: /auth/verify-email.
    email_verified: false,
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
    webauthn_challenge: null,
    webauthn_challenge_expires_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  await db.collection('users').doc(uid).set(data);
  return { id: uid, ...data };
}

async function getUserById(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function updateUser(uid, patch) {
  await db
    .collection('users')
    .doc(uid)
    .update({ ...patch, updated_at: new Date() });
}

module.exports = { createUserDoc, getUserById, updateUser };
