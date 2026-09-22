/** User serializers — SPEC.md Section 11. A user's account email/role/status is only ever
 * shown to the user themself or to Admin; it is never embedded in a counterpart-facing payload
 * (counterparts only ever see organization-level public views, see masking/organization.ts). */

export interface UserRecord {
  id: string;
  email: string;
  role: 'buyer' | 'supplier' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  email_verified_at: Date | null;
  last_login_at: Date | null;
  created_at: Date;
}

export interface SelfUserView {
  id: string;
  email: string;
  role: string;
  status: string;
  email_verified_at: Date | null;
  created_at: Date;
}

export function toSelfUserView(user: UserRecord): SelfUserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    email_verified_at: user.email_verified_at,
    created_at: user.created_at,
  };
}

export interface AdminUserView extends SelfUserView {
  last_login_at: Date | null;
}

export function toAdminUserView(user: UserRecord): AdminUserView {
  return {
    ...toSelfUserView(user),
    last_login_at: user.last_login_at,
  };
}
