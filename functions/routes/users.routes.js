const { Router } = require('express');
const sharp = require('sharp');
const { z } = require('zod');
const { bucket } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { parseMultipart } = require('../middleware/parseMultipart');
const { getUserById, updateUser } = require('../services/userService');
const { toSelfUserView } = require('../masking/user');
const { usernameSchema, zodFieldErrors } = require('../validation/auth');

const router = Router();

const ALLOWED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'];
const AVATAR_MAX_DIMENSION = 512;

// Magic-byte check — never trust the client-declared Content-Type alone.
function matchesFileSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

const patchUserSchema = z.object({ username: usernameSchema });

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: toSelfUserView(req.user) });
  }),
);

router.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    await updateUser(req.user.id, { username: parsed.data.username });
    const updated = await getUserById(req.user.id);
    res.json({ user: toSelfUserView(updated) });
  }),
);

/** Profile picture upload — low-sensitivity, always stored under a fixed per-user key so a
 * re-upload just overwrites the previous one. Decode-and-re-encode (not stored verbatim) caps
 * memory/CPU against a decompression-bomb image and guarantees what's stored is a genuinely
 * valid, normalized raster image. Port of src/app/api/users/me/avatar/route.ts. */
router.post(
  '/me/avatar',
  authenticate,
  parseMultipart('file', { maxSizeBytes: 2 * 1024 * 1024 }),
  asyncHandler(async (req, res) => {
    if (!ALLOWED_AVATAR_MIME_TYPES.includes(req.file.mimetype)) {
      throw Errors.validation({ file: 'Unsupported file type. Allowed: image/png, image/jpeg' });
    }
    if (!matchesFileSignature(req.file.buffer, req.file.mimetype)) {
      throw Errors.validation({ file: 'File content does not match its declared type.' });
    }

    let outputBuffer;
    try {
      outputBuffer = await sharp(req.file.buffer, { limitInputPixels: 268402689 })
        .resize({ width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION, fit: 'cover' })
        .png()
        .toBuffer();
    } catch {
      throw Errors.validation({ file: 'This image could not be processed.' });
    }

    const key = `avatars/${req.user.id}.png`;
    try {
      await bucket.file(key).save(outputBuffer, { contentType: 'image/png' });
    } catch {
      throw Errors.uploadFailed();
    }

    await updateUser(req.user.id, { avatar_storage_key: key, avatar_mime_type: 'image/png' });
    res.json({ ok: true });
  }),
);

router.delete(
  '/me/avatar',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.avatar_storage_key) {
      await bucket
        .file(req.user.avatar_storage_key)
        .delete()
        .catch(() => {});
    }
    await updateUser(req.user.id, { avatar_storage_key: null, avatar_mime_type: null });
    res.json({ ok: true });
  }),
);

/** Self-or-admin only — a raw <img src> can't carry an Authorization header, so the web/Flutter
 * client fetches this with a bearer token and renders the bytes as a blob, same as before. Not
 * public: sender_id on messages exposes raw user ids to counterparts, so an open avatar route
 * would be an identity leak (see src/app/api/users/[id]/avatar/route.ts's original comment). */
router.get(
  '/:id/avatar',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') throw Errors.forbidden();

    const target = req.user.id === req.params.id ? req.user : await getUserById(req.params.id);
    if (!target || !target.avatar_storage_key) throw Errors.notFound();

    const [buffer] = await bucket.file(target.avatar_storage_key).download();
    res.setHeader('Content-Type', target.avatar_mime_type || 'image/png');
    res.send(buffer);
  }),
);

module.exports = router;
