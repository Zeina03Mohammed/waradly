import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const buyerId = searchParams.get('buyer');
  const supplierId = searchParams.get('supplier');

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(buyerId ? { buyer_id: buyerId } : {}),
      ...(supplierId ? { supplier_id: supplierId } : {}),
      ...(category ? { rfq: { category_id: category } } : {}),
    },
    include: {
      rfq: { select: { title: true } },
      buyer: { include: { organization: true } },
      supplier: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      rfq_title: o.rfq.title,
      buyer_org_name: o.buyer.organization.legal_name,
      supplier_anonymized_id: o.supplier.anonymized_id,
      status: o.status,
      created_at: o.created_at,
    })),
  });
}
