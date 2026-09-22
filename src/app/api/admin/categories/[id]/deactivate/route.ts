import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

const OPEN_RFQ_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PUBLISHED', 'RECEIVING_OFFERS'] as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const category = await prisma.category.findUnique({ where: { id: params.id } });
  if (!category) return Errors.notFound();

  // Informational only — SPEC.md Section 7.4 says the warning is a UI-level confirmation;
  // the API still allows deactivation regardless of open RFQs.
  const openRfqCount = await prisma.rfq.count({
    where: { category_id: category.id, status: { in: [...OPEN_RFQ_STATUSES] } },
  });

  const updated = await prisma.category.update({ where: { id: category.id }, data: { status: 'coming_soon' } });

  await audit({
    actorId: auth.user.id,
    action: 'category.deactivated',
    entityType: 'category',
    entityId: category.id,
    before: { status: category.status },
    after: { status: updated.status, open_rfq_count_at_deactivation: openRfqCount },
  });

  return NextResponse.json({ category: updated, open_rfq_count: openRfqCount });
}
