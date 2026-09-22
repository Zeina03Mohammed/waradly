import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR';

/** Standard error envelope per SPEC.md Section 16/18: { error: { code, message } }. */
export function errorResponse(status: number, code: ErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export const Errors = {
  unauthenticated: () => errorResponse(401, 'UNAUTHENTICATED', 'Authentication required.'),
  forbidden: () => errorResponse(403, 'FORBIDDEN', "You don't have access to this."),
  notFound: () => errorResponse(404, 'NOT_FOUND', 'Not found.'),
  conflict: (message: string) => errorResponse(409, 'CONFLICT', message),
  validation: (fields: Record<string, string>) =>
    errorResponse(422, 'VALIDATION_ERROR', 'Validation failed.', { fields }),
  suspended: (status: 'suspended' | 'banned', reason: string | null) =>
    errorResponse(403, 'FORBIDDEN', `Your account has been ${status}. Please contact support.`, {
      status,
      reason,
    }),
  emailNotVerified: () =>
    errorResponse(403, 'FORBIDDEN', 'Please verify your email before logging in. Check your inbox for the verification link.', {
      reason: 'email_not_verified',
    }),
  lockedOut: () =>
    errorResponse(429, 'RATE_LIMITED', 'Too many failed attempts. Try again in 15 minutes.'),
  invalidCredentials: () => errorResponse(401, 'UNAUTHENTICATED', 'Invalid email or password.'),
  invalidToken: (message = 'This link is invalid or has expired.') =>
    errorResponse(400, 'VALIDATION_ERROR', message),
  duplicateEmail: () =>
    errorResponse(409, 'CONFLICT', 'An account with this email already exists.'),
};
