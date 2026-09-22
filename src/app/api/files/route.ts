import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { ALLOWED_MIME_TYPES, isAllowedMimeType, MAX_FILE_SIZE_BYTES } from '@/lib/files/constraints';
import { storageProvider } from '@/lib/storage/local';
import { audit } from '@/lib/audit';

/** Generic file upload — SPEC.md Section 16 (POST /files). Used by RFQ/offer attachment
 * flows, which reference the returned file id when creating their own records. */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier');
  if (denied) return denied;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Errors.validation({ file: 'Multipart form data with a "file" field is required.' });

  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return Errors.validation({ file: 'A file is required.' });
  }
  if (!isAllowedMimeType(fileEntry.type)) {
    return errorResponse(422, 'VALIDATION_ERROR', `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`, {
      fields: { file: 'Unsupported file type.' },
    });
  }
  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(422, 'VALIDATION_ERROR', 'File exceeds the 10 MB limit.', {
      fields: { file: 'File exceeds the 10 MB limit.' },
    });
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const id = randomUUID();
  const key = `${auth.user.id}/${id}-${fileEntry.name}`;

  try {
    await storageProvider.save(key, buffer);
  } catch {
    return errorResponse(502, 'UPLOAD_FAILED', 'Upload failed, please try again.');
  }

  const file = await prisma.file.create({
    data: {
      id,
      uploader_id: auth.user.id,
      storage_key: key,
      original_filename: fileEntry.name,
      mime_type: fileEntry.type,
      size_bytes: fileEntry.size,
    },
  });

  await audit({
    actorId: auth.user.id,
    action: 'file.uploaded',
    entityType: 'file',
    entityId: file.id,
    after: { original_filename: file.original_filename, mime_type: file.mime_type, size_bytes: file.size_bytes },
  });

  return NextResponse.json(
    { file: { id: file.id, original_filename: file.original_filename, mime_type: file.mime_type, size_bytes: file.size_bytes } },
    { status: 201 },
  );
}
