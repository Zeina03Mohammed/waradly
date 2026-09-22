import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';

const flagSchema = z.object({ note: z.string().trim().min(1).max(1000) });

/** "Flag Suspicious" (SPEC.md Section 7.8) — adds admin_notes, does not block the offer. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = flagSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const offer = await prisma.offer.findUnique({ where: { id: params.id } });
  if (!offer) return Errors.notFound();

  const updated = await prisma.offer.update({ where: { id: offer.id }, data: { admin_flag_note: parsed.data.note } });

  await audit({
    actorId: auth.user.id,
    action: 'offer.flagged',
    entityType: 'offer',
    entityId: offer.id,
    before: { admin_flag_note: offer.admin_flag_note },
    after: { admin_flag_note: updated.admin_flag_note },
  });

  return NextResponse.json({ offer: updated });
}
