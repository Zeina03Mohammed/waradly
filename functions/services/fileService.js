const { db, bucket, FieldValue } = require('../config/firebase');
const { EXTENSION_BY_MIME } = require('../config/fileConstraints');
const { generateWatermarkedDerivative } = require('./watermarkService');

async function createFile({ uploaderId, buffer, mimeType, originalFilename }) {
  const ref = db.collection('files').doc();
  const ext = EXTENSION_BY_MIME[mimeType];
  const storageKey = `files/${ref.id}/original.${ext}`;

  await bucket.file(storageKey).save(buffer, { contentType: mimeType });

  const data = {
    uploader_id: uploaderId,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: buffer.length,
    storage_key: storageKey,
    preview_storage_key: null,
    is_watermarked: false,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

async function getFileById(id) {
  const snap = await db.collection('files').doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/** Soft delete only (SPEC.md Section 12) — files referenced by an awarded Order must never be
 * hard-deletable, and there's no cheap way to check that from here yet (Order doesn't exist
 * until phase 7), so this phase enforces only ownership; the "still referenced" guard lands
 * with RFQ/offer attachments in phase 5. */
async function softDeleteFile(id) {
  await db.collection('files').doc(id).update({ deleted_at: FieldValue.serverTimestamp(), updated_at: new Date() });
}

/** Generates the watermarked derivative once and stores it alongside the original under the
 * same File doc (see plan: files/{id}/original.* and files/{id}/preview.* on one doc, not a
 * separate self-referential File row like the old Prisma model). Called by whichever feature
 * first needs a preview variant (RFQ attachments in phase 5, supplier verification never needs
 * one) — safe to call more than once, it just re-renders and overwrites.
 */
async function createWatermarkedPreview(file) {
  const [originalBuffer] = await bucket.file(file.storage_key).download();
  const previewBuffer = await generateWatermarkedDerivative(originalBuffer, file.mime_type);

  const ext = file.mime_type === 'application/pdf' ? 'pdf' : 'png';
  const previewMime = file.mime_type === 'application/pdf' ? 'application/pdf' : 'image/png';
  const previewKey = `files/${file.id}/preview.${ext}`;

  await bucket.file(previewKey).save(previewBuffer, { contentType: previewMime });
  await db.collection('files').doc(file.id).update({ preview_storage_key: previewKey, is_watermarked: true, updated_at: new Date() });

  return previewKey;
}

module.exports = { createFile, getFileById, softDeleteFile, createWatermarkedPreview };
