const { Errors } = require('../http/errors');

/** Port of src/lib/files/access.ts's decision point — deliberately small for now. A File isn't
 * yet attached to anything (RFQ attachments land in phase 5, supplier verification docs in
 * phase 4), so the only relationships that exist are "I uploaded this" and "I'm an admin".
 * Each later phase that introduces a new attachment type (RfqAttachment, SupplierVerification,
 * OrderStatusHistory evidence) extends this function with its own branch — callers never need
 * to change, since they just ask "can this viewer see this file, and which variant".
 *
 * Returns { allowed: true, variant: 'original' | 'preview' } or { allowed: false }. */
function resolveFileAccess({ file, viewer, requestedVariant }) {
  if (!file || file.deleted_at) return { allowed: false };

  const isOwner = file.uploader_id === viewer.id;
  const isAdmin = viewer.role === 'admin';

  if (isOwner || isAdmin) {
    if (requestedVariant === 'preview' && !file.is_watermarked) {
      // No preview variant exists — fail closed rather than silently serving the original
      // under a "preview" request, since a later attachment-type branch may rely on that
      // distinction being meaningful.
      return { allowed: false };
    }
    return { allowed: true, variant: requestedVariant };
  }

  return { allowed: false };
}

function assertFileAccess(args) {
  const result = resolveFileAccess(args);
  if (!result.allowed) throw Errors.notFound();
  return result;
}

module.exports = { resolveFileAccess, assertFileAccess };
