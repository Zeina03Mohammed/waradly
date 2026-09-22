import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';

const notesSchema = z.object({ admin_notes: z.string().trim().max(2000) });

/** SPEC.md Section 15: internal notes on RFQs are addressable per an audit-logged action;
 * never shown to buyer/supplier. There is no "quiet edit" path. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = notesSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const rfq = await prisma.rfq.findUnique({ where: { id: params.id } });
  if (!rfq) return Errors.notFound();

  const updated = await prisma.rfq.update({ where: { id: rfq.id }, data: { admin_notes: parsed.data.admin_notes } });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.notes_updated',
    entityType: 'rfq',
    entityId: rfq.id,
    before: { admin_notes: rfq.admin_notes },
    after: { admin_notes: updated.admin_notes },
  });

  return NextResponse.json({ admin_notes: updated.admin_notes });
}
