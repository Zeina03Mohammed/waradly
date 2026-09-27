/** The Admin SDK can create/manage users but cannot verify a password or exchange a refresh
 * token — that only exists on Firebase Auth's REST API (Identity Toolkit / Secure Token). This
 * wraps those two endpoints so /auth/login and /auth/refresh can stay server-only (no client-side
 * Firebase SDK needed for either web or Flutter — every client just calls our API).
 *
 * Auto-targets the Auth emulator when FIREBASE_AUTH_EMULATOR_HOST is set (the emulator accepts
 * any non-empty string as the API key), otherwise the real Google endpoints with
 * WEB_API_KEY (not FIREBASE_WEB_API_KEY — Cloud Functions rejects any env var starting with
 * the reserved FIREBASE_/X_GOOGLE_/EXT_ prefixes). */

const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const apiKey = process.env.WEB_API_KEY || 'emulator-key';

function baseUrl(service) {
  return emulatorHost ? `http://${emulatorHost}/${service}` : `https://${service}`;
}

async function callIdentityToolkit(path, body) {
  const url = `${baseUrl('identitytoolkit.googleapis.com')}/v1/accounts:${path}?key=${apiKey}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || 'auth request failed';
    const err = new Error(message);
    err.identityToolkitError = message;
    throw err;
  }
  return data;
}

/** Verifies email+password. Throws with `.identityToolkitError` (e.g. "INVALID_LOGIN_CREDENTIALS")
 * on bad credentials — never call this before the app-level lockout check. */
function signInWithPassword(email, password) {
  return callIdentityToolkit('signInWithPassword', { email, password, returnSecureToken: true });
}

async function exchangeRefreshToken(refreshToken) {
  const url = `${baseUrl('securetoken.googleapis.com')}/v1/token?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || 'refresh failed');
    err.identityToolkitError = data?.error?.message;
    throw err;
  }
  return { idToken: data.id_token, refreshToken: data.refresh_token, uid: data.user_id };
}

function resetPassword(oobCode, newPassword) {
  return callIdentityToolkit('resetPassword', { oobCode, newPassword });
}

function confirmEmailVerification(oobCode) {
  return callIdentityToolkit('update', { oobCode });
}

module.exports = { signInWithPassword, exchangeRefreshToken, resetPassword, confirmEmailVerification };
