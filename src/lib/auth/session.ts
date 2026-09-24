import type { NextRequest } from 'next/server';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, verifyAccessToken, verifyEnrollmentToken } from '@/lib/auth/jwt';
import { Errors } from '@/lib/http';

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; response: ReturnType<typeof Errors.unauthenticated> };

/**
 * Authenticates a request from its bearer token, re-checking the user's live status in the
 * database on every call — SPEC.md Section 4 requires a suspension to invalidate an existing
 * session immediately, which a stateless JWT alone cannot guarantee.
 */
export async function authenticate(request: NextRequest): Promise<AuthResult> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { ok: false, response: Errors.unauthenticated() };
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return { ok: false, response: Errors.unauthenticated() };
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return { ok: false, response: Errors.unauthenticated() };
  }

  if (user.status !== 'active') {
    return { ok: false, response: Errors.unauthenticated() };
  }

  return { ok: true, user };
}

/**
 * Like `authenticate()`, but also accepts a short-lived WebAuthn enrollment token (issued by
 * /auth/register) in place of a real session — the one carve-out that lets Face ID be set up
 * on the registration form itself, before email verification/login exist. A real access token
 * still works here too, so adding another device later from the Profile page uses the exact
 * same route with no separate code path.
 */
export async function authenticateForEnrollment(request: NextRequest): Promise<AuthResult> {
  const viaSession = await authenticate(request);
  if (viaSession.ok) return viaSession;

  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) return { ok: false, response: Errors.unauthenticated() };

  const payload = verifyEnrollmentToken(token);
  if (!payload) return { ok: false, response: Errors.unauthenticated() };

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'active') return { ok: false, response: Errors.unauthenticated() };

  return { ok: true, user };
}

export function hasRole(user: User, ...roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

/** Returns an error response if the user's role isn't allowed, otherwise null. Callers do:
 *  `const denied = requireRole(user, 'admin'); if (denied) return denied;` */
export function requireRole(user: User, ...roles: UserRole[]) {
  if (!hasRole(user, ...roles)) {
    return Errors.forbidden();
  }
  return null;
}
