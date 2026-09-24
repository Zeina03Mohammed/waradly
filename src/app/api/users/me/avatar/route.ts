import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticateForEnrollment } from '@/lib/auth/session';
import { storageProvider } from '@/lib/storage';
import { matchesFileSignature, MAX_IMAGE_PIXELS } from '@/lib/files/constraints';

const ALLOWED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_MAX_DIMENSION = 512;

/** Profile picture upload — a simple, low-sensitivity file separate from the RFQ/offer
 * attachment pipeline (no masking/watermarking concerns apply to a user's own avatar). Always
 * stored under a fixed per-user key so a re-upload just overwrites the previous one. */
export async function POST(request: NextRequest) {
  // Accepts the short-lived WebAuthn enrollment token too, not just a real session — lets a
  // supplier upload their photo on the registration success screen, before email
  // verification/login exist (see authenticateForEnrollment).
  const auth = await authenticateForEnrollment(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Errors.validation({ file: 'Multipart form data with a "file" field is required.' });

  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return Errors.validation({ file: 'A file is required.' });
  }
  if (!ALLOWED_AVATAR_MIME_TYPES.includes(fileEntry.type as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) {
    return errorResponse(422, 'VALIDATION_ERROR', 'Unsupported file type. Allowed: image/png, image/jpeg', {
      fields: { file: 'Unsupported file type.' },
    });
  }
  if (fileEntry.size > MAX_AVATAR_SIZE_BYTES) {
    return errorResponse(422, 'VALIDATION_ERROR', 'File exceeds the 2 MB limit.', {
      fields: { file: 'File exceeds the 2 MB limit.' },
    });
  }

  const rawBuffer = Buffer.from(await fileEntry.arrayBuffer());
  const claimedType = fileEntry.type as (typeof ALLOWED_AVATAR_MIME_TYPES)[number];
  if (!matchesFileSignature(rawBuffer, claimedType)) {
    return errorResponse(422, 'VALIDATION_ERROR', 'File content does not match its declared type.', {
      fields: { file: 'File content does not match its declared type.' },
    });
  }

  // Decode-and-re-encode rather than storing the upload verbatim: this both caps memory/CPU use
  // against a decompression-bomb-style image (limitInputPixels refuses to decode anything past
  // the cap, before doing the expensive work) and guarantees what's stored is a genuinely valid,
  // normalized raster image rather than merely "starts with the right magic bytes".
  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(rawBuffer, { limitInputPixels: MAX_IMAGE_PIXELS })
      .resize({ width: AVATAR_MAX_DIMENSION, height: AVATAR_MAX_DIMENSION, fit: 'cover' })
      .png()
      .toBuffer();
  } catch {
    return errorResponse(422, 'VALIDATION_ERROR', 'This image could not be processed.', {
      fields: { file: 'This image could not be processed.' },
    });
  }

  const key = `avatars/${auth.user.id}`;
  const outputMimeType = 'image/png';

  try {
    await storageProvider.save(key, outputBuffer);
  } catch {
    return errorResponse(502, 'UPLOAD_FAILED', 'Upload failed, please try again.');
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { avatar_storage_key: key, avatar_mime_type: outputMimeType },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateForEnrollment(request);
  if (!auth.ok) return auth.response;

  if (auth.user.avatar_storage_key) {
    await storageProvider.delete(auth.user.avatar_storage_key).catch(() => {});
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { avatar_storage_key: null, avatar_mime_type: null },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
