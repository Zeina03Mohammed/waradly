import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { getSupplierProfileForUser } from '@/lib/profiles';
import { canTransitionOffer } from '@/lib/stateMachines/offer';
import { serializeOfferForSupplier } from '@/lib/offer/serialize';
import { audit } from '@/lib/audit';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const supplierProfile = await getSupplierProfileForUser(auth.user.id);
  if (!supplierProfile) return Errors.notFound();

  const offer = await prisma.offer.findUnique({ where: { id: params.id }, include: { attachments: true } });
  if (!offer || offer.supplier_id !== supplierProfile.id) return Errors.notFound();

  if (!canTransitionOffer(offer.status, 'WITHDRAWN')) {
    return Errors.conflict('This action is not available for the current status.');
  }

  const updated = await prisma.offer.update({
    where: { id: offer.id },
    data: { status: 'WITHDRAWN', withdrawn_at: new Date() },
    include: { attachments: true },
  });

  await audit({
    actorId: auth.user.id,
    action: 'offer.withdrawn',
    entityType: 'offer',
    entityId: offer.id,
    before: { status: offer.status },
    after: { status: updated.status },
  });

  return NextResponse.json({ offer: serializeOfferForSupplier(updated) });
}
