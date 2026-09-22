import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate, requireRole } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role: role as never } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { organizations: { some: { legal_name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    include: { organizations: true },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      org_name: u.organizations[0]?.legal_name ?? null,
      created_at: u.created_at,
    })),
  });
}
