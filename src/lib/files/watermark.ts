import sharp from 'sharp';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { MAX_IMAGE_PIXELS, MAX_PDF_PAGES } from '@/lib/files/constraints';

const WATERMARK_TEXT = 'WARADLY CONFIDENTIAL';

/** Simple static diagonal text overlay — SPEC.md Section 12 ("no OCR involved").
 * `limitInputPixels` makes sharp refuse to decode a decompression-bomb-style image (a small
 * file that claims an enormous pixel count) before doing any expensive work, rather than
 * attempting to allocate a buffer for it. */
async function watermarkImage(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS });
  const metadata = await image.metadata();
  const width = metadata.width ?? 800;
  const height = metadata.height ?? 600;
  const fontSize = Math.max(24, Math.floor(width / 12));

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        transform="rotate(-30 ${width / 2} ${height / 2})"
        font-family="sans-serif" font-weight="bold" font-size="${fontSize}"
        fill="rgba(200,30,30,0.4)">${WATERMARK_TEXT}</text>
    </svg>`;

  return image.composite([{ input: Buffer.from(svg), gravity: 'center' }]).toBuffer();
}

async function watermarkPdf(buffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);

  // A malicious PDF could claim thousands of pages to burn CPU/memory drawing text on each one
  // — cap it rather than trusting the page count is reasonable just because the file parsed.
  if (pdfDoc.getPageCount() > MAX_PDF_PAGES) {
    throw new Error(`PDF exceeds the ${MAX_PDF_PAGES}-page limit.`);
  }

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(24, Math.floor(width / 14));
    const textWidth = font.widthOfTextAtSize(WATERMARK_TEXT, fontSize);
    page.drawText(WATERMARK_TEXT, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.78, 0.12, 0.12),
      opacity: 0.4,
      rotate: degrees(-30),
    });
  }

  return Buffer.from(await pdfDoc.save());
}

export async function generateWatermarkedCopy(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === 'application/pdf') return watermarkPdf(buffer);
  return watermarkImage(buffer);
}
