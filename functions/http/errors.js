/** Port of src/lib/http.ts — same {error:{code,message,...extra}} envelope and status codes,
 * reshaped for Express: these are thrown/passed to next() rather than returned directly, and
 * errorHandler.js turns them into the actual HTTP response. */

class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const Errors = {
  unauthenticated: () => new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'),
  forbidden: () => new ApiError(403, 'FORBIDDEN', "You don't have access to this."),
  notFound: () => new ApiError(404, 'NOT_FOUND', 'Not found.'),
  conflict: (message) => new ApiError(409, 'CONFLICT', message),
  validation: (fields) => new ApiError(422, 'VALIDATION_ERROR', 'Validation failed.', { fields }),
  suspended: (status, reason) =>
    new ApiError(403, 'FORBIDDEN', `Your account has been ${status}. Please contact support.`, { status, reason }),
  emailNotVerified: () =>
    new ApiError(403, 'FORBIDDEN', 'Please verify your email before logging in. Check your inbox for the verification link.', {
      reason: 'email_not_verified',
    }),
  lockedOut: () => new ApiError(429, 'RATE_LIMITED', 'Too many failed attempts. Try again in 15 minutes.'),
  invalidCredentials: () => new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password.'),
  invalidToken: (message = 'This link is invalid or has expired.') => new ApiError(400, 'VALIDATION_ERROR', message),
  duplicateEmail: () => new ApiError(409, 'CONFLICT', 'An account with this email already exists.'),
  uploadFailed: (message = 'Upload failed, please try again.') => new ApiError(502, 'UPLOAD_FAILED', message),
};

module.exports = { ApiError, Errors };
