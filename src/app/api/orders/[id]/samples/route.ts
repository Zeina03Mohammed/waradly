import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const submitSampleSchema = z.object({ evidence_file_id: z.string().uuid(), note: z.string().trim().max(1000).optional() });

/** SPEC.md Section 10.1 #5: supplier submits sample evidence, moving the order into
 * SAMPLE_REVIEW for the buyer to approve/reject. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { rfq: true, buyer: { include: { organization: true } } } });
  if (!order || order.supplier_id !== supplierProfile.id) return Errors.notFound();

  if (!order.sample_required || order.status !== 'PRODUCTION') {
    return Errors.conflict('This action is not available for the current status.');
  }

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = submitSampleSchema.safeParse(json);
  if (!parsed.success) return Errors.validation({ evidence_file_id: 'An evidence file is required.' });

  const owned = await allFilesOwnedBy([parsed.data.evidence_file_id], auth.user.id);
  if (!owned) return Errors.validation({ evidence_file_id: 'This file was not uploaded by you.' });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.order.update({ where: { id: order.id }, data: { status: 'SAMPLE_REVIEW' } });
    await tx.orderStatusHistory.create({
      data: {
        order_id: order.id,
        from_status: order.status,
        to_status: 'SAMPLE_REVIEW',
        changed_by: auth.user.id,
        evidence_file_id: parsed.data.evidence_file_id,
        note: parsed.data.note,
      },
    });
    return u;
  });

  await audit({
    actorId: auth.user.id,
    action: 'order.status_changed',
    entityType: 'order',
    entityId: order.id,
    before: { status: order.status },
    after: { status: updated.status },
  });

  const buyerOwnerId = order.buyer.organization.owner_user_id;
  const buyerOwner = await prisma.user.findUnique({ where: { id: buyerOwnerId } });
  if (buyerOwner) {
    await notify({
      userId: buyerOwner.id,
      eventType: 'order.sample_ready',
      message: `A sample is ready for your review on "${order.rfq.title}".`,
      link: `/buyer/orders/${order.id}`,
      email: {
        to: buyerOwner.email,
        subject: 'Sample ready for review on Wardly',
        body: `A sample for your order "${order.rfq.title}" is ready for review. Please log in to approve or reject it.`,
      },
    });
  }

  return NextResponse.json({ order: updated });
}
