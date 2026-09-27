const { Router } = require('express');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { parseMultipart } = require('../middleware/parseMultipart');
const { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES, matchesFileSignature, sanitizeFilename } = require('../config/fileConstraints');
const { createFile, getFileById, softDeleteFile } = require('../services/fileService');
const { assertFileAccess } = require('../services/fileAccessService');
const { createSignedFileUrl } = require('../config/signedUrl');
const { audit } = require('../services/auditService');

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole('buyer', 'supplier'),
  parseMultipart('file', { maxSizeBytes: MAX_SIZE_BYTES }),
  asyncHandler(async (req, res) => {
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      throw Errors.validation({ file: 'Unsupported file type. Allowed: image/png, image/jpeg, application/pdf' });
    }
    if (!matchesFileSignature(req.file.buffer, req.file.mimetype)) {
      throw Errors.validation({ file: 'File content does not match its declared type.' });
    }

    const file = await createFile({
      uploaderId: req.user.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalFilename: sanitizeFilename(req.file.originalname),
    });

    await audit({ actorId: req.user.id, action: 'file.uploaded', entityType: 'file', entityId: file.id });

    res.status(201).json({ file: { id: file.id, original_filename: file.original_filename, mime_type: file.mime_type, size_bytes: file.size_bytes } });
  }),
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const file = await getFileById(req.params.id);
    if (!file || file.deleted_at) throw Errors.notFound();
    if (file.uploader_id !== req.user.id && req.user.role !== 'admin') throw Errors.forbidden();

    await softDeleteFile(file.id);
    await audit({ actorId: req.user.id, action: 'file.deleted', entityType: 'file', entityId: file.id });

    res.status(204).send();
  }),
);

async function serveVariant(req, res, variant) {
  const file = await getFileById(req.params.id);
  assertFileAccess({ file, viewer: req.user, requestedVariant: variant });

  const storageKey = variant === 'preview' ? file.preview_storage_key : file.storage_key;
  const url = await createSignedFileUrl(storageKey);

  await audit({ actorId: req.user.id, action: `file.${variant}_viewed`, entityType: 'file', entityId: file.id });
  res.json({ url });
}

router.get(
  '/:id/original',
  authenticate,
  asyncHandler((req, res) => serveVariant(req, res, 'original')),
);

router.get(
  '/:id/preview',
  authenticate,
  asyncHandler((req, res) => serveVariant(req, res, 'preview')),
);

module.exports = router;
