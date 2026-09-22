import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { serializeOrder, type OrderViewer } from '@/lib/order/serialize';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      rfq: true,
      offer: true,
      buyer: { include: { organization: true } },
      supplier: { include: { organization: true } },
      status_history: { orderBy: { changed_at: 'asc' } },
      rating: true,
    },
  });
  if (!order) return Errors.notFound();

  let viewer: OrderViewer;
  if (auth.user.role === 'admin') {
    viewer = 'admin';
  } else if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile || order.buyer_id !== buyerProfile.id) return Errors.notFound();
    viewer = 'buyer';
  } else {
    const supplierProfile = await getSupplierProfileForUser(auth.user.id);
    if (!supplierProfile || order.supplier_id !== supplierProfile.id) return Errors.notFound();
    viewer = 'supplier';
  }

  return NextResponse.json({
    order: serializeOrder({
      viewer,
      order,
      rfqTitle: order.rfq.title,
      offerSummary: order.offer,
      buyerOrg: order.buyer.organization,
      supplierOrg: order.supplier.organization,
      supplierProfile: order.supplier,
      statusHistory: order.status_history,
      rating: order.rating,
    }),
  });
}
