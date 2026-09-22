import { prisma } from '@/lib/prisma';
import type { UserStatus } from '@prisma/client';
import { audit } from '@/lib/audit';

/** Suspending/banning revokes every refresh token immediately — SPEC.md Section 4: "any
 * existing session is invalidated immediately server-side on suspension." */
async function setUserStatus(userId: string, actorId: string, status: UserStatus, action: string, reason?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const before = { status: user.status };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    prisma.refreshToken.updateMany({ where: { user_id: userId }, data: { revoked: true } }),
  ]);

  await audit({ actorId, action, entityType: 'user', entityId: userId, before, after: { status, reason: reason ?? null } });
}

export function suspendUserAccount(userId: string, actorId: string, reason: string) {
  return setUserStatus(userId, actorId, 'suspended', 'user.suspended', reason);
}

export function banUserAccount(userId: string, actorId: string, reason: string) {
  return setUserStatus(userId, actorId, 'banned', 'user.banned', reason);
}

export function reactivateUserAccount(userId: string, actorId: string) {
  return setUserStatus(userId, actorId, 'active', 'user.reactivated');
}
