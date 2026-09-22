import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/session';
import { toSelfUserView } from '@/lib/masking/user';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ user: toSelfUserView(auth.user) }, { status: 200 });
}
