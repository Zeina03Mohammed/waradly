const { getFileById } = require('./fileService');

/** Port of src/lib/files/ownership.ts — a client can't attach someone else's uploaded file id to
 * their RFQ/offer/verification doc. */
async function allFilesOwnedBy(fileIds, uploaderId) {
  const files = await Promise.all(fileIds.map(getFileById));
  return files.every((file) => file && !file.deleted_at && file.uploader_id === uploaderId);
}

module.exports = { allFilesOwnedBy };
