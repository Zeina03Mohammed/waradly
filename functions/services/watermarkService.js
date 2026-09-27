const sharp = require('sharp');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const { MAX_IMAGE_PIXELS, MAX_PDF_PAGES } = require('../config/fileConstraints');

const WATERMARK_TEXT = 'WARADLY CONFIDENTIAL';

/** Port of src/lib/files/watermark.ts — a static diagonal overlay, generated once at upload for
 * identity-risk RFQ attachments (SPEC.md Section 12). No OCR, no per-view dynamic rendering. */
async function generateWatermarkedImage(buffer) {
  const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS });
  const meta = await image.metadata();
  const width = meta.width || 800;
  const height = meta.height || 600;

  const fontSize = Math.max(24, Math.round(width / 12));
  const svg = `
    <svg width="${width}" height="${height}">
      <style>
        .wm { fill: rgba(255,255,255,0.35); font-size: ${fontSize}px; font-family: sans-serif; font-weight: bold; }
      </style>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            class="wm" transform="rotate(-30 ${width / 2} ${height / 2})">${WATERMARK_TEXT}</text>
    </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), gravity: 'center' }])
    .png()
    .toBuffer();
}

async function generateWatermarkedPdf(buffer) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  if (pdf.getPageCount() > MAX_PDF_PAGES) {
    throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page watermarking limit.`);
  }

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(WATERMARK_TEXT, {
      x: width / 2 - 150,
      y: height / 2,
      size: 28,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.4,
      rotate: degrees(-30),
    });
  }
  return Buffer.from(await pdf.save());
}

/** Dispatches by mime type. Throws for anything else — callers only invoke this for
 * identity-risk attachments, which are always png/jpeg/pdf per the upload-time mime check. */
async function generateWatermarkedDerivative(buffer, mimeType) {
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') return generateWatermarkedImage(buffer);
  if (mimeType === 'application/pdf') return generateWatermarkedPdf(buffer);
  throw new Error(`Cannot watermark mime type: ${mimeType}`);
}

module.exports = { generateWatermarkedImage, generateWatermarkedPdf, generateWatermarkedDerivative };
