import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const rfqId = searchParams.get('rfq');
  const supplierId = searchParams.get('supplier');
  const status = searchParams.get('status');

  const offers = await prisma.offer.findMany({
    where: {
      ...(rfqId ? { rfq_id: rfqId } : {}),
      ...(supplierId ? { supplier_id: supplierId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: { rfq: { select: { title: true } }, supplier: true },
    orderBy: { submitted_at: 'desc' },
  });

  return NextResponse.json({
    offers: offers.map((o) => ({
      id: o.id,
      rfq_title: o.rfq.title,
      supplier_anonymized_id: o.supplier.anonymized_id,
      unit_price: o.unit_price,
      status: o.status,
      submitted_at: o.submitted_at,
      admin_flag_note: o.admin_flag_note,
    })),
  });
}
