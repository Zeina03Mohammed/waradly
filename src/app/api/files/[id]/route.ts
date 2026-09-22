import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

const EDITABLE_RFQ_STATUSES = ['DRAFT', 'SUBMITTED'];
const EDITABLE_OFFER_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

/** Soft delete only (SPEC.md Section 12). Owner may delete only while the parent RFQ/offer is
 * still editable; files referenced by an awarded Order are never deletable through the UI. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const file = await prisma.file.findUnique({
    where: { id: params.id },
    include: {
      rfq_attachments: { include: { rfq: true } },
      offer_attachments: { include: { offer: true } },
    },
  });
  if (!file || file.deleted_at) return Errors.notFound();

  if (auth.user.role === 'admin') {
    return softDelete(file.id, auth.user.id, 'Admin removal');
  }

  if (file.uploader_id !== auth.user.id) return Errors.forbidden();

  const parentRfq = file.rfq_attachments[0]?.rfq;
  if (parentRfq && !EDITABLE_RFQ_STATUSES.includes(parentRfq.status)) {
    return Errors.forbidden();
  }

  const parentOffer = file.offer_attachments[0]?.offer;
  if (parentOffer && !EDITABLE_OFFER_STATUSES.includes(parentOffer.status)) {
    return Errors.forbidden();
  }

  return softDelete(file.id, auth.user.id);
}

async function softDelete(fileId: string, actorId: string, reason?: string) {
  await prisma.file.update({ where: { id: fileId }, data: { deleted_at: new Date() } });
  await audit({ actorId, action: 'file.deleted', entityType: 'file', entityId: fileId, after: { reason: reason ?? null } });
  return new NextResponse(null, { status: 204 });
}
