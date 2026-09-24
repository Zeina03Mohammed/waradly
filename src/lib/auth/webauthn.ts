/** Relying Party config, derived from APP_BASE_URL so it works in dev (localhost) and
 * production without separate config. WebAuthn requires rpID to be exactly the domain (no
 * scheme/port) and origin to be the full scheme+host+port the browser actually sees. */
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const ORIGIN_URL = new URL(APP_BASE_URL);

export const RP_NAME = 'Waradly';
export const RP_ID = ORIGIN_URL.hostname;
export const ORIGIN = ORIGIN_URL.origin;

export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
