import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { reviewSupplierVerificationSchema } from '@/lib/validation/supplierVerification';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = reviewSupplierVerificationSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const supplier = await prisma.supplierProfile.findUnique({
    where: { id: params.id },
    include: { organization: true },
  });
  if (!supplier) return Errors.notFound();

  const before = { verification_status: supplier.verification_status };
  const { status, reason } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.supplierProfile.update({ where: { id: supplier.id }, data: { verification_status: status } });
    await tx.supplierVerification.updateMany({
      where: { supplier_id: supplier.id, status: 'pending' },
      data: {
        status,
        reviewed_by: auth.user.id,
        reviewed_at: new Date(),
        rejection_reason: status === 'rejected' ? reason : null,
      },
    });
    return s;
  });

  await audit({
    actorId: auth.user.id,
    action: 'supplier.verification_reviewed',
    entityType: 'supplier_profile',
    entityId: supplier.id,
    before,
    after: { verification_status: updated.verification_status, reason: reason ?? null },
  });

  await notify({
    userId: supplier.organization.owner_user_id,
    eventType: status === 'verified' ? 'supplier.approved' : 'supplier.rejected',
    message:
      status === 'verified'
        ? 'Your supplier account has been verified. You can now browse and quote on RFQs.'
        : `Your supplier verification was rejected: ${reason}`,
    link: '/supplier/verification',
    email: {
      to: (await prisma.user.findUnique({ where: { id: supplier.organization.owner_user_id } }))!.email,
      subject: status === 'verified' ? 'Your Wardly supplier account is verified' : 'Your Wardly verification was rejected',
      body:
        status === 'verified'
          ? 'Congratulations — your supplier account has been verified. You can now browse and quote on RFQs in your approved categories.'
          : `Your supplier verification was rejected.\n\nReason: ${reason}\n\nYou can upload additional documents and resubmit from your Verification Status page.`,
    },
  });

  return NextResponse.json({ supplier: updated });
}
