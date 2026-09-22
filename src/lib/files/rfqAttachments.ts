import { randomUUID } from 'node:crypto';
import type { Prisma, RfqAttachmentType } from '@prisma/client';
import { storageProvider } from '@/lib/storage';
import { generateWatermarkedCopy } from '@/lib/files/watermark';

export interface AttachmentInput {
  file_id: string;
  type: RfqAttachmentType;
  contains_identity_risk: boolean;
}

/**
 * Reconciles an RFQ's rfq_attachments rows to match the given list (RFQ is only ever editable
 * pre-publish, so add/remove is safe). For any newly-added attachment flagged
 * contains_identity_risk, generates its watermarked preview derivative once, per SPEC.md
 * Section 12 ("Wardly Confidential" overlay, generated once at upload time).
 */
export async function syncRfqAttachments(
  tx: Prisma.TransactionClient,
  rfqId: string,
  attachments: AttachmentInput[],
  uploaderId: string,
): Promise<void> {
  const existing = await tx.rfqAttachment.findMany({ where: { rfq_id: rfqId } });
  const keepFileIds = new Set(attachments.map((a) => a.file_id));

  for (const existingAttachment of existing) {
    if (!keepFileIds.has(existingAttachment.file_id)) {
      await tx.rfqAttachment.delete({ where: { id: existingAttachment.id } });
    }
  }

  for (const attachment of attachments) {
    const already = existing.find((e) => e.file_id === attachment.file_id);
    if (already) {
      if (already.type !== attachment.type || already.contains_identity_risk !== attachment.contains_identity_risk) {
        await tx.rfqAttachment.update({
          where: { id: already.id },
          data: { type: attachment.type, contains_identity_risk: attachment.contains_identity_risk },
        });
      }
      if (attachment.contains_identity_risk) {
        await ensureWatermarkDerivative(tx, attachment.file_id, uploaderId);
      }
      continue;
    }

    if (attachment.contains_identity_risk) {
      await ensureWatermarkDerivative(tx, attachment.file_id, uploaderId);
    }

    await tx.rfqAttachment.create({
      data: {
        rfq_id: rfqId,
        file_id: attachment.file_id,
        type: attachment.type,
        contains_identity_risk: attachment.contains_identity_risk,
      },
    });
  }
}

async function ensureWatermarkDerivative(tx: Prisma.TransactionClient, fileId: string, uploaderId: string): Promise<void> {
  const file = await tx.file.findUnique({ where: { id: fileId }, include: { preview_derivative: true } });
  if (!file || file.preview_derivative) return; // already generated, or file missing (caller pre-validates existence)

  const original = await storageProvider.read(file.storage_key);
  const watermarked = await generateWatermarkedCopy(original, file.mime_type);
  const derivativeId = randomUUID();
  const derivativeKey = `${uploaderId}/${derivativeId}-preview-${file.original_filename}`;
  await storageProvider.save(derivativeKey, watermarked);

  await tx.file.create({
    data: {
      id: derivativeId,
      uploader_id: uploaderId,
      storage_key: derivativeKey,
      original_filename: `preview-${file.original_filename}`,
      mime_type: file.mime_type,
      size_bytes: watermarked.length,
      is_preview_watermarked: true,
      preview_of_file_id: file.id,
    },
  });
}
