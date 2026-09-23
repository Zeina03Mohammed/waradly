// SPEC.md Section 12.
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Guards against decompression-bomb style uploads (a tiny file that decodes to an enormous
// bitmap) before handing anything to sharp/pdf-lib for processing.
export const MAX_IMAGE_PIXELS = 40_000_000; // ~40MP, comfortably above any real photo/scan
export const MAX_PDF_PAGES = 200;

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * The client's declared Content-Type is just a string it chose to send — a request can claim
 * `image/png` while the bytes are anything at all. This checks the actual file signature
 * (magic bytes) so upload validation isn't relying on an attacker-controlled label. Deliberately
 * dependency-free (no `file-type` package): these are the only three formats this app accepts,
 * and all three have short, fixed, well-known signatures.
 */
/**
 * Strips path separators and control characters from a client-supplied filename before it's
 * used as part of a storage key or echoed into the Content-Disposition header. Prevents a
 * crafted filename from breaking out of the `filename="..."` quoted parameter (a stray `"`) or,
 * for the local dev storage backend, from being combined with `..` segments — defense in depth
 * alongside LocalStorageProvider's own root-containment check.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base.replace(/[\x00-\x1f"\\]/g, '_').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'file';
}

export function matchesFileSignature(buffer: Buffer, mime: AllowedMimeType): boolean {
  if (buffer.length < 8) return false;
  switch (mime) {
    case 'image/png':
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'application/pdf':
      return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    default:
      return false;
  }
}
