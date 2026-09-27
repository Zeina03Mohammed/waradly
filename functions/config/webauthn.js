/** Port of src/lib/auth/webauthn.ts. */
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';
const ORIGIN_URL = new URL(APP_BASE_URL);

const RP_NAME = 'Waradly';
const RP_ID = ORIGIN_URL.hostname;
const ORIGIN = ORIGIN_URL.origin;
const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

module.exports = { RP_NAME, RP_ID, ORIGIN, WEBAUTHN_CHALLENGE_TTL_MS };
