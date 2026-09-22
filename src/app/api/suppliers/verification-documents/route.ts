import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { VerificationDocumentType } from '@prisma/client';
import { errorResponse, Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { ALLOWED_MIME_TYPES, isAllowedMimeType, MAX_FILE_SIZE_BYTES } from '@/lib/files/constraints';
import { storageProvider } from '@/lib/storage';
import { audit } from '@/lib/audit';

const ALLOWED_DOC_TYPES: VerificationDocumentType[] = ['commercial_registration', 'certificate', 'other'];

/** OD-P-03: document upload only in P0, reviewed manually by Admin. */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'supplier');
  if (denied) return denied;

  const formData = await request.formData().catch(() => null);
  if (!formData) return Errors.validation({ file: 'Multipart form data is required.' });

  const fileEntry = formData.get('file');
  const documentType = formData.get('document_type');

  if (!(fileEntry instanceof File)) return Errors.validation({ file: 'A file is required.' });
  if (typeof documentType !== 'string' || !ALLOWED_DOC_TYPES.includes(documentType as VerificationDocumentType)) {
    return Errors.validation({ document_type: `document_type must be one of: ${ALLOWED_DOC_TYPES.join(', ')}` });
  }
  if (!isAllowedMimeType(fileEntry.type)) {
    return errorResponse(422, 'VALIDATION_ERROR', `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(422, 'VALIDATION_ERROR', 'File exceeds the 10 MB limit.');
  }

  const org = await prisma.organization.findFirst({
    where: { owner_user_id: auth.user.id, type: 'supplier' },
    include: { supplier_profile: true },
  });
  if (!org?.supplier_profile) return Errors.notFound();

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  const id = randomUUID();
  const key = `verification/${org.supplier_profile.id}/${id}-${fileEntry.name}`;

  try {
    await storageProvider.save(key, buffer);
  } catch {
    return errorResponse(502, 'UPLOAD_FAILED', 'Upload failed, please try again.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const file = await tx.file.create({
      data: {
        id,
        uploader_id: auth.user.id,
        storage_key: key,
        original_filename: fileEntry.name,
        mime_type: fileEntry.type,
        size_bytes: fileEntry.size,
      },
    });
    const verification = await tx.supplierVerification.create({
      data: {
        supplier_id: org.supplier_profile!.id,
        document_type: documentType as VerificationDocumentType,
        file_id: file.id,
      },
    });
    return { file, verification };
  });

  await audit({
    actorId: auth.user.id,
    action: 'supplier_verification.document_submitted',
    entityType: 'supplier_verification',
    entityId: result.verification.id,
    after: { document_type: documentType, file_id: result.file.id },
  });

  return NextResponse.json({ verification: result.verification }, { status: 201 });
}
