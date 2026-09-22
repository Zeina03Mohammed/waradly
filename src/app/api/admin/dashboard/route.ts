import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const [pendingSuppliers, rfqsAwaitingReview, flaggedMessages, openDisputes, ordersByStatusRaw] = await Promise.all([
    prisma.supplierVerification.count({ where: { status: 'pending' } }),
    prisma.rfq.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.messageFlag.count({ where: { status: 'pending_review' } }),
    prisma.dispute.count({ where: { status: 'open' } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const ordersByStatus = Object.fromEntries(ordersByStatusRaw.map((row) => [row.status, row._count._all]));

  return NextResponse.json({
    pending_supplier_approvals: pendingSuppliers,
    rfqs_awaiting_review: rfqsAwaitingReview,
    flagged_messages: flaggedMessages,
    open_disputes: openDisputes,
    orders_by_status: ordersByStatus,
  });
}
