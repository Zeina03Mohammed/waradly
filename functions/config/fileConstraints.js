/** Port of src/lib/files/constraints.ts — SPEC.md Section 12: png/jpeg/pdf only, 10MB cap. */

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 268402689; // sharp's own default decompression-bomb ceiling
const MAX_PDF_PAGES = 50; // a bomb guard, not a real product limit

// Magic-byte check — never trust the client-declared Content-Type alone.
function matchesFileSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'application/pdf') {
    return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
  }
  return false;
}

const EXTENSION_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };

function sanitizeFilename(name) {
  const base = (name || 'file').replace(/[\\/]/g, '_').replace(/[^\w.\- ]/g, '').trim();
  return (base || 'file').slice(0, 150);
}

module.exports = { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES, MAX_IMAGE_PIXELS, MAX_PDF_PAGES, matchesFileSignature, EXTENSION_BY_MIME, sanitizeFilename };
