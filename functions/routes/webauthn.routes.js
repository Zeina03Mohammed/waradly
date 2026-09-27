const { Router } = require('express');
const { generateRegistrationOptions, verifyRegistrationResponse } = require('@simplewebauthn/server');
const { db, Timestamp } = require('../config/firebase');
const { RP_NAME, RP_ID, ORIGIN, WEBAUTHN_CHALLENGE_TTL_MS } = require('../config/webauthn');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { updateUser } = require('../services/userService');
const { audit } = require('../services/auditService');

const router = Router();

function credentialsRef(uid) {
  return db.collection('users').doc(uid).collection('webauthn_credentials');
}

/** One-time device verification at registration (see plan) — not a login method. `authenticate`
 * works here unmodified since /auth/register now returns a real session immediately; the old
 * system's separate short-lived "enrollment token" is gone. */
router.post(
  '/register-options',
  authenticate,
  asyncHandler(async (req, res) => {
    const existing = await credentialsRef(req.user.id).select('credential_id', 'transports').get();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: req.user.email,
      userID: new TextEncoder().encode(req.user.id),
      attestationType: 'none',
      excludeCredentials: existing.docs.map((d) => ({ id: d.data().credential_id, transports: d.data().transports })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await updateUser(req.user.id, {
      webauthn_challenge: options.challenge,
      webauthn_challenge_expires_at: Timestamp.fromMillis(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS),
    });

    res.json(options);
  }),
);

router.post(
  '/register-verify',
  authenticate,
  asyncHandler(async (req, res) => {
    const { webauthn_challenge, webauthn_challenge_expires_at } = req.user;
    if (!webauthn_challenge || !webauthn_challenge_expires_at || webauthn_challenge_expires_at.toMillis() < Date.now()) {
      throw Errors.invalidToken('No pending registration, or it expired — try again.');
    }

    const response = req.body?.response;
    if (!response) throw Errors.validation({ _: 'Missing WebAuthn response.' });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: webauthn_challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch {
      throw Errors.validation({ _: 'Could not verify this device.' });
    }

    await updateUser(req.user.id, { webauthn_challenge: null, webauthn_challenge_expires_at: null });

    if (!verification.verified || !verification.registrationInfo) {
      throw Errors.validation({ _: 'Could not verify this device.' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const ref = await credentialsRef(req.user.id).add({
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: response.response?.transports ?? [],
      label: req.body?.label?.trim().slice(0, 100) || null,
      created_at: new Date(),
      last_used_at: null,
    });

    await audit({
      actorId: req.user.id,
      action: 'auth.webauthn_registered',
      entityType: 'user',
      entityId: req.user.id,
      after: { credential_id: ref.id, device_type: credentialDeviceType },
    });

    res.json({ ok: true, credential: { id: ref.id, device_type: credentialDeviceType } });
  }),
);

router.get(
  '/credentials',
  authenticate,
  asyncHandler(async (req, res) => {
    const snap = await credentialsRef(req.user.id).orderBy('created_at', 'desc').get();
    res.json({
      credentials: snap.docs.map((d) => ({
        id: d.id,
        label: d.data().label,
        device_type: d.data().device_type,
        created_at: d.data().created_at,
        last_used_at: d.data().last_used_at,
      })),
    });
  }),
);

router.delete(
  '/credentials/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const ref = credentialsRef(req.user.id).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) throw Errors.notFound();

    await ref.delete();
    await audit({
      actorId: req.user.id,
      action: 'auth.webauthn_removed',
      entityType: 'user',
      entityId: req.user.id,
      before: { credential_id: req.params.id },
    });

    res.status(204).send();
  }),
);

module.exports = router;
