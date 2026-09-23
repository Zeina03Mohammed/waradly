import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { requiredSecret } from '@/lib/env';

const ACCESS_SECRET = requiredSecret('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
const REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');

// SPEC.md Section 4: access token 24h expiry, refresh token 30 days.
const ACCESS_TOKEN_TTL = '24h';
const REFRESH_TOKEN_TTL = '30d';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
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
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
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

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
