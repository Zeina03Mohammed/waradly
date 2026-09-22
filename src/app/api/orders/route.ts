import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { serializeOrder, type OrderViewer } from '@/lib/order/serialize';

const ORDER_INCLUDE = {
  rfq: true,
  offer: true,
  buyer: { include: { organization: true } },
  supplier: { include: { organization: true } },
  rating: true,
} as const;

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const statusFilter = request.nextUrl.searchParams.get('status');
  let where: Record<string, unknown> = {};
  let viewer: OrderViewer;

  if (auth.user.role === 'admin') {
    viewer = 'admin';
  } else if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile) return Errors.notFound();
    where = { buyer_id: buyerProfile.id };
    viewer = 'buyer';
  } else {
    const supplierProfile = await getSupplierProfileForUser(auth.user.id);
    if (!supplierProfile) return Errors.notFound();
    where = { supplier_id: supplierProfile.id };
    viewer = 'supplier';
  }

  if (statusFilter) where = { ...where, status: statusFilter };

  const orders = await prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { created_at: 'desc' } });

  return NextResponse.json({
    orders: orders.map((order) =>
      serializeOrder({
        viewer,
        order,
        rfqTitle: order.rfq.title,
        offerSummary: order.offer,
        buyerOrg: order.buyer.organization,
        supplierOrg: order.supplier.organization,
        supplierProfile: order.supplier,
        rating: order.rating,
      }),
    ),
  });
}
