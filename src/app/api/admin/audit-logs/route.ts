import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';
import { buildEntityLabels, formatEntityType } from '@/lib/audit/entityLabels';

/** Append-only, admin-only read (SPEC.md Section 19/7.14) — no update/delete endpoint exists
 * for audit_logs at any role. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const actorId = searchParams.get('actor');
  const entityType = searchParams.get('entity_type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(actorId ? { actor_id: actorId } : {}),
      ...(entityType ? { entity_type: entityType } : {}),
      ...(from || to
        ? {
            created_at: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    take: 500,
    include: { actor: { select: { email: true, phone: true } } },
  });

  const labels = await buildEntityLabels(logs);
  const withLabels = logs.map((l) => ({
    ...l,
    entity_type_label: formatEntityType(l.entity_type),
    entity_label: labels.get(`${l.entity_type}:${l.entity_id}`) ?? null,
  }));

  return NextResponse.json({ logs: withLabels });
}
