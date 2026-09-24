import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticateForEnrollment } from '@/lib/auth/session';
import { RP_ID, ORIGIN } from '@/lib/auth/webauthn';
import { audit } from '@/lib/audit';

/** Step 2: verify the browser's attestation against the challenge we issued, then save the
 * credential. Same dual-auth as register-options — real session or enrollment token. */
export async function POST(request: NextRequest) {
  const auth = await authenticateForEnrollment(request);
  if (!auth.ok) return auth.response;

  if (!auth.user.webauthn_challenge || !auth.user.webauthn_challenge_expires_at || auth.user.webauthn_challenge_expires_at < new Date()) {
    return Errors.invalidToken('No pending registration, or it expired — try again.');
  }

  const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON; label?: string } | null;
  if (!body?.response) return Errors.validation({ _: 'Missing WebAuthn response.' });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: auth.user.webauthn_challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch {
    return Errors.validation({ _: 'Could not verify this device.' });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { webauthn_challenge: null, webauthn_challenge_expires_at: null },
  });

  if (!verification.verified || !verification.registrationInfo) {
    return Errors.validation({ _: 'Could not verify this device.' });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const saved = await prisma.webAuthnCredential.create({
    data: {
      user_id: auth.user.id,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: body.response.response.transports ?? [],
      label: body.label?.trim().slice(0, 100) || null,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: 'auth.webauthn_registered',
    entityType: 'user',
    entityId: auth.user.id,
    after: { credential_id: saved.id, device_type: saved.device_type },
  });

  return NextResponse.json({ ok: true, credential: { id: saved.id, device_type: saved.device_type, created_at: saved.created_at } });
}
