import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getBuyerProfileForUser } from '@/lib/profiles';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer');
  if (denied) return denied;

  const buyerProfile = await getBuyerProfileForUser(auth.user.id);
  if (!buyerProfile) return Errors.notFound();

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { rfq: true, supplier: { include: { organization: true } } },
  });
  if (!order || order.buyer_id !== buyerProfile.id) return Errors.notFound();
  if (order.status !== 'SAMPLE_REVIEW') return Errors.conflict('This action is not available for the current status.');

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = decisionSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const approved = parsed.data.decision === 'approve';
  const toStatus = approved ? 'PRODUCTION' : 'DISPUTED';

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: order.id }, data: { status: toStatus } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: 'SAMPLE_REVIEW', to_status: toStatus, changed_by: auth.user.id },
    });
    if (!approved) {
      await tx.dispute.create({
        data: {
          order_id: order.id,
          raised_by: auth.user.id,
          category: 'sample_rejection',
          description: 'Buyer rejected the submitted sample.',
        },
      });
    }
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.sample_decision',
    entityType: 'order',
    entityId: order.id,
    before: { status: 'SAMPLE_REVIEW' },
    after: { status: updated.status, decision: parsed.data.decision },
  });

  const supplierOwnerId = order.supplier.organization.owner_user_id;
  const supplierOwner = await prisma.user.findUnique({ where: { id: supplierOwnerId } });
  if (supplierOwner) {
    await notify({
      userId: supplierOwner.id,
      eventType: 'order.sample_decision',
      message: approved
        ? `Your sample for "${order.rfq.title}" was approved — production can resume.`
        : `Your sample for "${order.rfq.title}" was rejected.`,
      link: `/supplier/orders/${order.id}`,
      email: {
        to: supplierOwner.email,
        subject: approved ? 'Your Waradly sample was approved' : 'Your Waradly sample was rejected',
        body: approved
          ? `Your sample for "${order.rfq.title}" was approved. You can resume production.`
          : `Your sample for "${order.rfq.title}" was rejected. A dispute has been opened for review.`,
      },
    });
  }

  return NextResponse.json({ order: updated });
}
