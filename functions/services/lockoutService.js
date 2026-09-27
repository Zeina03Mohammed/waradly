const { db, Timestamp } = require('../config/firebase');

const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Port of the lockout logic inlined in src/app/api/auth/login/route.ts, factored out since
 * Firebase Auth has no native attempt counter to fall back on. */
function isLockedOut(user) {
  return Boolean(user.locked_until && user.locked_until.toMillis() > Date.now());
}

async function recordFailedAttempt(uid, user) {
  const now = Date.now();
  const withinWindow = user.last_failed_login_at && now - user.last_failed_login_at.toMillis() < LOCKOUT_WINDOW_MS;
  const attempts = withinWindow ? (user.failed_login_attempts || 0) + 1 : 1;
  const locked_until = attempts >= MAX_ATTEMPTS ? Timestamp.fromMillis(now + LOCKOUT_WINDOW_MS) : null;

  await db.collection('users').doc(uid).update({
    failed_login_attempts: attempts,
    last_failed_login_at: Timestamp.fromMillis(now),
    locked_until,
  });

  return { lockedOut: Boolean(locked_until) };
}

async function resetLockout(uid) {
  await db.collection('users').doc(uid).update({
    failed_login_attempts: 0,
    last_failed_login_at: null,
    locked_until: null,
  });
}

module.exports = { isLockedOut, recordFailedAttempt, resetLockout, MAX_ATTEMPTS, LOCKOUT_WINDOW_MS };
