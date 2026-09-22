import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { suspendUserAccount } from '@/lib/users/moderation';

const reasonSchema = z.object({ reason: z.string().trim().min(1, 'A reason is required.').max(500) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = reasonSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return Errors.notFound();

  await suspendUserAccount(user.id, auth.user.id, parsed.data.reason);

  return NextResponse.json({ ok: true });
}
