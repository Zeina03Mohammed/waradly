import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/auth/session';
import { toSelfUserView } from '@/lib/masking/user';
import { Errors } from '@/lib/http';
import { usernameSchema, zodFieldErrors } from '@/lib/validation/auth';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ user: toSelfUserView(auth.user) }, { status: 200 });
}

const updateSchema = z.object({ username: usernameSchema });

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const user = await prisma.user.update({ where: { id: auth.user.id }, data: { username: parsed.data.username } });

  return NextResponse.json({ user: toSelfUserView(user) }, { status: 200 });
}
