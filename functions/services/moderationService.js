const { auth } = require('../config/firebase');
const { updateUser } = require('./userService');
const { audit } = require('./auditService');

/** Port of src/lib/users/moderation.ts — status change + revoke every session + audit, shared by
 * admin/users/* (phase 10) and the message-flag escalation ladder (phase 8). */
async function suspendUserAccount(uid, { reason, actorId }) {
  await updateUser(uid, { status: 'suspended', status_reason: reason ?? null });
  await auth.revokeRefreshTokens(uid);
  await audit({ actorId, action: 'user.suspended', entityType: 'user', entityId: uid, after: { reason } });
}

async function banUserAccount(uid, { reason, actorId }) {
  await updateUser(uid, { status: 'banned', status_reason: reason ?? null });
  await auth.revokeRefreshTokens(uid);
  await audit({ actorId, action: 'user.banned', entityType: 'user', entityId: uid, after: { reason } });
}

async function reactivateUserAccount(uid, { actorId }) {
  await updateUser(uid, { status: 'active', status_reason: null });
  await audit({ actorId, action: 'user.reactivated', entityType: 'user', entityId: uid });
}

module.exports = { suspendUserAccount, banUserAccount, reactivateUserAccount };
