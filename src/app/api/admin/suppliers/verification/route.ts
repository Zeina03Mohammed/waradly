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

  const verifications = await prisma.supplierVerification.findMany({
    where: {
      status: 'pending',
      ...(category
        ? { supplier: { categories: { some: { category_id: category } } } }
        : {}),
    },
    include: {
      file: true,
      supplier: {
        include: {
          organization: true,
          categories: { include: { category: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({ verifications });
}
