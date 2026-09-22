import { prisma } from '@/lib/prisma';

/** Confirms every referenced file id exists, isn't deleted, and belongs to the uploader —
 * prevents one user from attaching a file id they didn't upload to their own RFQ/offer. */
export async function allFilesOwnedBy(fileIds: string[], uploaderId: string): Promise<boolean> {
  if (fileIds.length === 0) return true;
  const uniqueIds = Array.from(new Set(fileIds));
  const count = await prisma.file.count({
    where: { id: { in: uniqueIds }, uploader_id: uploaderId, deleted_at: null },
  });
  return count === uniqueIds.length;
}
