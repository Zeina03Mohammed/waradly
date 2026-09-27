const { auth, db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');

/** Verifies the Firebase ID token, then re-reads users/{uid} fresh from Firestore on every
 * request (never trusts role/status baked into the cached token) so a suspend/ban takes effect
 * immediately — same guarantee as the old JWT system's per-request DB lookup. */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw Errors.unauthenticated();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token, true); // checkRevoked
  } catch {
    throw Errors.unauthenticated();
  }

  const snap = await db.collection('users').doc(decoded.uid).get();
  if (!snap.exists) throw Errors.unauthenticated();

  const user = { id: snap.id, ...snap.data() };
  if (user.status !== 'active') throw Errors.unauthenticated();

  req.user = user;
  next();
});

module.exports = { authenticate };
