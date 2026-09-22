import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { openDisputeSchema } from '@/lib/validation/dispute';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const NON_DISPUTABLE = ['COMPLETED', 'CANCELLED', 'DISPUTED'];

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const status = request.nextUrl.searchParams.get('status');

  const disputes = await prisma.dispute.findMany({
    where: status ? { status: status as never } : {},
    include: { order: { include: { rfq: { select: { title: true } } } } },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json({
    disputes: disputes.map((d) => ({
      id: d.id,
      order_id: d.order_id,
      rfq_title: d.order.rfq.title,
      raised_by: d.raised_by,
      category: d.category,
      status: d.status,
      created_at: d.created_at,
    })),
  });
}

/** Open a dispute — SPEC.md Section 2 permits Buyer, Supplier, or Admin. */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier', 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = openDisputeSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.order_id },
    include: { rfq: true, buyer: { include: { organization: true } }, supplier: { include: { organization: true } } },
  });
  if (!order) return Errors.notFound();

  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile || order.buyer_id !== buyerProfile.id) return Errors.notFound();
  } else if (auth.user.role === 'supplier') {
    const supplierProfile = await getSupplierProfileForUser(auth.user.id);
    if (!supplierProfile || order.supplier_id !== supplierProfile.id) return Errors.notFound();
  }

  if (NON_DISPUTABLE.includes(order.status)) {
    return Errors.conflict('This action is not available for the current status.');
  }

  const before = order.status;

  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        order_id: order.id,
        raised_by: auth.user.id,
        category: parsed.data.category,
        description: parsed.data.description,
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'DISPUTED' } });
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, from_status: before, to_status: 'DISPUTED', changed_by: auth.user.id, note: parsed.data.description },
    });
    return created;
  });

  await audit({ actorId: auth.user.id, action: 'dispute.opened', entityType: 'dispute', entityId: dispute.id, after: dispute });

  for (const ownerId of [order.buyer.organization.owner_user_id, order.supplier.organization.owner_user_id]) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) continue;
    await notify({
      userId: owner.id,
      eventType: 'dispute.opened',
      message: `A dispute was opened on the order for "${order.rfq.title}".`,
      link: `/orders/${order.id}`,
      email: {
        to: owner.email,
        subject: 'A dispute was opened on your Wardly order',
        body: `A dispute was opened on your order for "${order.rfq.title}". Admin will review and follow up.`,
      },
    });
  }

  return NextResponse.json({ dispute }, { status: 201 });
}
