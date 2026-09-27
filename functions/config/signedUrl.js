const { bucket } = require('./firebase');

const SIGNED_URL_TTL_MS = 5 * 60 * 1000; // SPEC.md Section 12: always short-lived, 5 min

/** Firebase Storage's own V4 signed URL — replaces the old hand-rolled HMAC scheme (see plan:
 * "platform-native equivalent"). The bucket itself stays private; a real signed URL is a raw
 * GCS-level credential that Cloud Storage serves directly, bypassing Security Rules entirely
 * (a different code path from the Firebase SDK/REST download endpoint, which IS rule-gated) —
 * this is what keeps the bucket private while still letting the URL work for whoever it's
 * handed to.
 *
 * Known local-only limitation: getSignedUrl() needs a real service-account private key, which
 * the Storage emulator has no access to (throws SigningError every time) — this function can't
 * be exercised end-to-end against the emulator. Verify uploads/downloads locally via the Admin
 * SDK directly (bypasses rules, same as this does in production); this code path only proves
 * itself out against a real deployed Firebase project. */
async function createSignedFileUrl(storageKey) {
  const [url] = await bucket.file(storageKey).getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
    version: 'v4',
  });
  return url;
}

module.exports = { createSignedFileUrl, SIGNED_URL_TTL_MS };
