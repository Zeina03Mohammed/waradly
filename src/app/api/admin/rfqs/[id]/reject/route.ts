import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { serializeRfqForViewer } from '@/lib/rfq/serialize';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.').max(500),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = rejectSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const rfq = await prisma.rfq.findUnique({
    where: { id: params.id },
    include: { items: true, attachments: true, buyer: { include: { organization: true } } },
  });
  if (!rfq) return Errors.notFound();
  if (rfq.status !== 'UNDER_REVIEW') {
    return Errors.conflict('This action is not available for the current status.');
  }

  const updated = await prisma.rfq.update({
    where: { id: rfq.id },
    data: { status: 'REJECTED', rejection_reason: parsed.data.reason },
    include: { items: true, attachments: true },
  });

  await audit({
    actorId: auth.user.id,
    action: 'rfq.rejected',
    entityType: 'rfq',
    entityId: rfq.id,
    before: { status: rfq.status },
    after: { status: updated.status, reason: parsed.data.reason },
  });

  const ownerId = rfq.buyer.organization.owner_user_id;
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (owner) {
    await notify({
      userId: owner.id,
      eventType: 'rfq.rejected',
      message: `Your RFQ "${rfq.title}" was rejected: ${parsed.data.reason}`,
      link: `/buyer/rfqs/${rfq.id}`,
      email: {
        to: owner.email,
        subject: 'Your Wardly RFQ was rejected',
        body: `Your RFQ "${rfq.title}" was rejected by Admin.\n\nReason: ${parsed.data.reason}\n\nYou can edit and resubmit it from your RFQ details page.`,
      },
    });
  }

  return NextResponse.json({ rfq: serializeRfqForViewer('admin', updated) });
}
