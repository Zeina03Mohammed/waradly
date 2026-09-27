/** Port of src/lib/masking/user.ts — allowlist views of a user doc. */

function toSelfUserView(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    username: user.username ?? null,
    has_avatar: Boolean(user.avatar_storage_key),
    role: user.role,
    status: user.status,
    email_verified: Boolean(user.email_verified),
  };
}

function toAdminUserView(user) {
  return {
    ...toSelfUserView(user),
    status_reason: user.status_reason ?? null,
    failed_login_attempts: user.failed_login_attempts || 0,
    locked_until: user.locked_until ?? null,
    created_at: user.created_at ?? null,
  };
}

module.exports = { toSelfUserView, toAdminUserView };
