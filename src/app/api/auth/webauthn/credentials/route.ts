import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const credentials = await prisma.webAuthnCredential.findMany({
    where: { user_id: auth.user.id },
    select: { id: true, label: true, device_type: true, created_at: true, last_used_at: true },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({ credentials });
}
