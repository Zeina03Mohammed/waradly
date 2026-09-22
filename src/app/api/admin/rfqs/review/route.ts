import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const rfqs = await prisma.rfq.findMany({
    where: {
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      ...(category ? { category_id: category } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { buyer: { organization: { legal_name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    include: { category: true, buyer: { include: { organization: true } } },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({
    rfqs: rfqs.map((r) => ({
      id: r.id,
      title: r.title,
      buyer_org_name: r.buyer.organization.legal_name,
      category: r.category?.name ?? null,
      quantity: r.quantity,
      status: r.status,
      created_at: r.created_at,
    })),
  });
}
