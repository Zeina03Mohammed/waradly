import { prisma } from '@/lib/prisma';
import type { FileVariant } from '@/lib/storage/signedUrl';

export type FileAccessResult =
  | { allowed: true; servedFileId: string }
  | { allowed: false; reason: 'not_found' | 'forbidden' };

/**
 * Central permission resolver for file access (SPEC.md Section 12). A file can be attached to
 * an RFQ, an Offer, a supplier verification, or order evidence — each has its own access rule.
 * `servedFileId` is the actual file to stream: for an RFQ attachment's "preview" variant this
 * is the watermarked derivative when one exists, otherwise the file itself.
 */
export async function resolveFileAccess(
  fileId: string,
  userId: string,
  variant: FileVariant,
): Promise<FileAccessResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'active') return { allowed: false, reason: 'forbidden' };

  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: {
      preview_derivative: true,
      rfq_attachments: { include: { rfq: true } },
      offer_attachments: { include: { offer: { include: { rfq: true } } } },
      supplier_verifications: true,
      order_status_evidence: { include: { order: true } },
    },
  });
  if (!file || file.deleted_at) return { allowed: false, reason: 'not_found' };

  const servedFileId = variant === 'preview' && file.preview_derivative ? file.preview_derivative.id : file.id;

  if (user.role === 'admin') {
    return { allowed: true, servedFileId };
  }

  if (file.rfq_attachments.length > 0) {
    const rfq = file.rfq_attachments[0].rfq;

    if (user.role === 'buyer' && (await isOwnerOfBuyerProfile(user.id, rfq.buyer_id))) {
      return { allowed: true, servedFileId };
    }

    if (user.role === 'supplier') {
      const supplierProfile = await getSupplierProfileForUser(user.id);
      if (!supplierProfile) return { allowed: false, reason: 'forbidden' };

      if (variant === 'preview') {
        const eligible =
          (rfq.status === 'PUBLISHED' || rfq.status === 'RECEIVING_OFFERS') &&
          (await isSupplierApprovedForCategory(supplierProfile.id, rfq.category_id));
        if (eligible) return { allowed: true, servedFileId };
      }

      if (variant === 'original') {
        const order = await prisma.order.findUnique({ where: { rfq_id: rfq.id } });
        if (order && order.supplier_id === supplierProfile.id) {
          // Awarded supplier gets the true original, never a watermarked copy.
          return { allowed: true, servedFileId: file.id };
        }
      }
    }
    return { allowed: false, reason: 'forbidden' };
  }

  if (file.offer_attachments.length > 0) {
    const offer = file.offer_attachments[0].offer;

    if (user.role === 'buyer' && (await isOwnerOfBuyerProfile(user.id, offer.rfq.buyer_id))) {
      return { allowed: true, servedFileId: file.id };
    }
    if (user.role === 'supplier' && (await isOwnerOfSupplierProfile(user.id, offer.supplier_id))) {
      return { allowed: true, servedFileId: file.id };
    }
    return { allowed: false, reason: 'forbidden' };
  }

  if (file.supplier_verifications.length > 0) {
    const verification = file.supplier_verifications[0];
    if (user.role === 'supplier' && (await isOwnerOfSupplierProfile(user.id, verification.supplier_id))) {
      return { allowed: true, servedFileId: file.id };
    }
    return { allowed: false, reason: 'forbidden' };
  }

  if (file.order_status_evidence.length > 0) {
    const order = file.order_status_evidence[0].order;
    const isBuyerOwner = user.role === 'buyer' && (await isOwnerOfBuyerProfile(user.id, order.buyer_id));
    const isSupplierOwner = user.role === 'supplier' && (await isOwnerOfSupplierProfile(user.id, order.supplier_id));
    if (isBuyerOwner || isSupplierOwner) return { allowed: true, servedFileId: file.id };
    return { allowed: false, reason: 'forbidden' };
  }

  // Not yet attached to any parent record (e.g. uploaded moments before the parent RFQ/offer
  // is created) — only the uploader may view it until it's attached.
  if (file.uploader_id === user.id) {
    return { allowed: true, servedFileId: file.id };
  }

  return { allowed: false, reason: 'forbidden' };
}

async function isOwnerOfBuyerProfile(userId: string, buyerProfileId: string): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { owner_user_id: userId, type: 'buyer' },
    include: { buyer_profile: true },
  });
  return org?.buyer_profile?.id === buyerProfileId;
}

async function isOwnerOfSupplierProfile(userId: string, supplierProfileId: string): Promise<boolean> {
  const org = await prisma.organization.findFirst({
    where: { owner_user_id: userId, type: 'supplier' },
    include: { supplier_profile: true },
  });
  return org?.supplier_profile?.id === supplierProfileId;
}

async function getSupplierProfileForUser(userId: string) {
  const org = await prisma.organization.findFirst({
    where: { owner_user_id: userId, type: 'supplier' },
    include: { supplier_profile: true },
  });
  return org?.supplier_profile ?? null;
}

async function isSupplierApprovedForCategory(supplierId: string, categoryId: string): Promise<boolean> {
  const row = await prisma.supplierCategory.findUnique({
    where: { supplier_id_category_id: { supplier_id: supplierId, category_id: categoryId } },
  });
  return !!row?.approved;
}
