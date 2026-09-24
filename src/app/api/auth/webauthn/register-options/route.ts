import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { authenticateForEnrollment } from '@/lib/auth/session';
import { RP_NAME, RP_ID, WEBAUTHN_CHALLENGE_TTL_MS } from '@/lib/auth/webauthn';

/** Step 1 of enrolling Face ID / Touch ID / a security key: issue a challenge for the browser
 * to pass to navigator.credentials.create(). Accepts either a real session (adding a device
 * later from Profile) or the short-lived enrollment token /auth/register just issued (setting
 * it up right on the registration form, before email verification/login exist). */
export async function POST(request: NextRequest) {
  const auth = await authenticateForEnrollment(request);
  if (!auth.ok) return auth.response;

  const existing = await prisma.webAuthnCredential.findMany({
    where: { user_id: auth.user.id },
    select: { credential_id: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: auth.user.email,
    userID: new TextEncoder().encode(auth.user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports as never })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { webauthn_challenge: options.challenge, webauthn_challenge_expires_at: new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_MS) },
  });

  return NextResponse.json(options);
}
