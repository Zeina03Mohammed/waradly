import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { storageProvider } from '@/lib/storage';

const ALLOWED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'] as const;
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Profile picture upload — a simple, low-sensitivity file separate from the RFQ/offer
 * attachment pipeline (no masking/watermarking concerns apply to a user's own avatar). Always
 * stored under a fixed per-user key so a re-upload just overwrites the previous one. */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
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

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const key = `avatars/${auth.user.id}`;

  try {
    await storageProvider.save(key, buffer);
  } catch {
    return errorResponse(502, 'UPLOAD_FAILED', 'Upload failed, please try again.');
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { avatar_storage_key: key, avatar_mime_type: fileEntry.type },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
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
