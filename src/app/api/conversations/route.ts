import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getBuyerProfileForUser, getSupplierProfileForUser } from '@/lib/profiles';
import { isSupplierEligibleForRfqFeed } from '@/lib/rfq/eligibility';

const openConversationSchema = z
  .object({
    rfq_id: z.string().uuid().optional(),
    order_id: z.string().uuid().optional(),
    supplier_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (Boolean(data.rfq_id) === Boolean(data.order_id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rfq_id'], message: 'Provide exactly one of rfq_id or order_id.' });
    }
  });

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let where: Record<string, unknown> = {};
  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile) return Errors.notFound();
    where = { buyer_id: buyerProfile.id };
  } else if (auth.user.role === 'supplier') {
    const supplierProfile = await getSupplierProfileForUser(auth.user.id);
    if (!supplierProfile) return Errors.notFound();
    where = { supplier_id: supplierProfile.id };
  }
  // admin: no filter, sees all.

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy: { updated_at: 'desc' },
  });

  return NextResponse.json({ conversations });
}

/**
 * Not enumerated as its own row in Section 16 (only POST /conversations/{id}/messages is
 * listed), but Section 13 requires a conversation to be "created automatically the first time
 * a buyer or supplier sends a message" tied to an RFQ or Order — this find-or-create endpoint
 * is what the client calls to get that conversation id before sending the first message.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = openConversationSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  if (parsed.data.rfq_id) {
    const rfq = await prisma.rfq.findUnique({ where: { id: parsed.data.rfq_id } });
    if (!rfq) return Errors.notFound();

    let supplierId: string;
    let buyerId: string;

    if (auth.user.role === 'buyer') {
      const buyerProfile = await getBuyerProfileForUser(auth.user.id);
      if (!buyerProfile || rfq.buyer_id !== buyerProfile.id) return Errors.notFound();
      if (!parsed.data.supplier_id) return Errors.validation({ supplier_id: 'supplier_id is required.' });
      const supplier = await prisma.supplierProfile.findUnique({ where: { id: parsed.data.supplier_id } });
      if (!supplier) return Errors.validation({ supplier_id: 'Supplier not found.' });
      supplierId = supplier.id;
      buyerId = buyerProfile.id;
    } else {
      const supplierProfile = await getSupplierProfileForUser(auth.user.id);
      if (!supplierProfile) return Errors.notFound();
      const hasOffer = await prisma.offer.findUnique({
        where: { rfq_id_supplier_id: { rfq_id: rfq.id, supplier_id: supplierProfile.id } },
      });
      if (!hasOffer && !(await isSupplierEligibleForRfqFeed(supplierProfile.id, rfq))) {
        return Errors.forbidden();
      }
      supplierId = supplierProfile.id;
      buyerId = rfq.buyer_id;
    }

    const conversation = await prisma.conversation.upsert({
      where: { rfq_id_supplier_id: { rfq_id: rfq.id, supplier_id: supplierId } },
      update: {},
      create: { rfq_id: rfq.id, supplier_id: supplierId, buyer_id: buyerId },
    });

    return NextResponse.json({ conversation }, { status: 200 });
  }

  // order_id branch
  const order = await prisma.order.findUnique({ where: { id: parsed.data.order_id! } });
  if (!order) return Errors.notFound();

  if (auth.user.role === 'buyer') {
    const buyerProfile = await getBuyerProfileForUser(auth.user.id);
    if (!buyerProfile || order.buyer_id !== buyerProfile.id) return Errors.notFound();
  } else {
    const supplierProfile = await getSupplierProfileForUser(auth.user.id);
    if (!supplierProfile || order.supplier_id !== supplierProfile.id) return Errors.notFound();
  }

  let conversation = await prisma.conversation.findFirst({ where: { order_id: order.id } });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { order_id: order.id, buyer_id: order.buyer_id, supplier_id: order.supplier_id },
    });
  }

  return NextResponse.json({ conversation }, { status: 200 });
}
