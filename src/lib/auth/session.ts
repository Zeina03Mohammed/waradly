import type { NextRequest } from 'next/server';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth/jwt';
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

export function hasRole(user: User, ...roles: UserRole[]): boolean {
  return roles.includes(user.role);
}
