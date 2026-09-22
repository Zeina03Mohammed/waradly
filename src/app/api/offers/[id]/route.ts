import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { updateOfferSchema } from '@/lib/validation/offer';
import { zodFieldErrors } from '@/lib/validation/auth';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { allFilesOwnedBy } from '@/lib/files/ownership';
import { isOfferEditable } from '@/lib/stateMachines/offer';
import { serializeOfferForSupplier } from '@/lib/offer/serialize';
import { audit } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const offer = await prisma.offer.findUnique({ where: { id: params.id }, include: { attachments: true } });
  if (!offer || offer.supplier_id !== supplierProfile.id) return Errors.notFound();

  return NextResponse.json({ offer: serializeOfferForSupplier(offer) });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const offer = await prisma.offer.findUnique({ where: { id: params.id }, include: { rfq: true, attachments: true } });
  if (!offer || offer.supplier_id !== supplierProfile.id) return Errors.notFound();

  if (!isOfferEditable(offer.status) || !offer.rfq.offer_deadline_at || offer.rfq.offer_deadline_at < new Date()) {
    return errorResponse(403, 'FORBIDDEN', 'This offer can no longer be modified.');
  }

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = updateOfferSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));
  const { attachments, ...fields } = parsed.data;

  if (attachments) {
    const owned = await allFilesOwnedBy(attachments.map((a) => a.file_id), auth.user.id);
    if (!owned) return Errors.validation({ attachments: 'One or more attachments were not uploaded by you.' });
  }

  const before = serializeOfferForSupplier(offer);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.offer.update({ where: { id: offer.id }, data: fields });

    if (attachments) {
      const keepIds = new Set(attachments.map((a) => a.file_id));
      await tx.offerAttachment.deleteMany({ where: { offer_id: offer.id, file_id: { notIn: Array.from(keepIds) } } });
      const existingIds = new Set((await tx.offerAttachment.findMany({ where: { offer_id: offer.id } })).map((a) => a.file_id));
      const toCreate = attachments.filter((a) => !existingIds.has(a.file_id));
      if (toCreate.length > 0) {
        await tx.offerAttachment.createMany({
          data: toCreate.map((a) => ({ offer_id: offer.id, file_id: a.file_id, type: a.type })),
        });
      }
    }

    return tx.offer.findUniqueOrThrow({ where: { id: offer.id }, include: { attachments: true } });
  });

  const after = serializeOfferForSupplier(updated);
  await audit({ actorId: auth.user.id, action: 'offer.updated', entityType: 'offer', entityId: offer.id, before, after });

  return NextResponse.json({ offer: after });
}
