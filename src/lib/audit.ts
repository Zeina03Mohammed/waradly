import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Append-only audit log writer — SPEC.md Section 19. Every state-changing action in the
 * backlog wires through this helper. `actorId` is null only for genuine system actions
 * (e.g. the scheduled RFQ-expiry job), never as a way to skip attribution.
 */
export async function audit(
  params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      before_state: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after_state: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
