import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { requiredSecret } from '@/lib/env';

const ACCESS_SECRET = requiredSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
const REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');

// SPEC.md Section 4: access token 24h expiry, refresh token 30 days.
const ACCESS_TOKEN_TTL = '24h';
const REFRESH_TOKEN_TTL = '30d';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Deliberately short and single-purpose: lets the registration form immediately offer Face ID
// enrollment before email verification/login exist, without granting a real session. Verified
// separately from a normal access token (see verifyEnrollmentToken) and only ever consumed by
// the WebAuthn register-options/register-verify routes — it can attach one credential to the
// account it was issued for and nothing else.
const ENROLLMENT_TOKEN_TTL = '15m';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface EnrollmentTokenPayload {
  sub: string;
  purpose: 'webauthn_enroll';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload & { purpose?: string };
    // Shares a signing secret with the enrollment token below — an access token must never be
    // confused with one, since `authenticate()` re-fetches the live user by `sub` alone and
    // would otherwise grant a full session to a token meant only to attach a WebAuthn
    // credential.
    if (payload.purpose) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export function signEnrollmentToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'webauthn_enroll' } satisfies EnrollmentTokenPayload, ACCESS_SECRET, {
    expiresIn: ENROLLMENT_TOKEN_TTL,
  });
}

export function verifyEnrollmentToken(token: string): EnrollmentTokenPayload | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as Partial<EnrollmentTokenPayload>;
    if (payload.purpose !== 'webauthn_enroll' || typeof payload.sub !== 'string') return null;
    return payload as EnrollmentTokenPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
