import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveFileAccess } from '@/lib/files/access';
import { verifySignedFileUrl, type FileVariant } from '@/lib/storage/signedUrl';
import { storageProvider } from '@/lib/storage';
import { audit } from '@/lib/audit';

/**
 * The actual byte-streaming route behind a signed URL. It has no Authorization header (it's
 * meant to be hit from a plain <img>/<a> tag), so the signature + embedded user id stand in
 * for auth, and permission is re-resolved fresh from the DB rather than trusted from the URL —
 * this is the "verifies the signature and permission before streaming" requirement.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; variant: string } },
) {
  const variant = params.variant as FileVariant;
  if (variant !== 'preview' && variant !== 'original') {
    return new NextResponse('Not found', { status: 404 });
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('u');
  const expiresAt = Number(searchParams.get('e'));
  const signature = searchParams.get('s');

  if (!userId || !signature || !verifySignedFileUrl({ fileId: params.id, variant, userId, expiresAt }, signature)) {
    return new NextResponse('This link is invalid or has expired.', { status: 403 });
  }

  const access = await resolveFileAccess(params.id, userId, variant);
  if (!access.allowed) {
    return new NextResponse(access.reason === 'not_found' ? 'Not found' : 'Forbidden', {
      status: access.reason === 'not_found' ? 404 : 403,
    });
  }

  const file = await prisma.file.findUnique({ where: { id: access.servedFileId } });
  if (!file || file.deleted_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = await storageProvider.read(file.storage_key);

  await audit({
    actorId: userId,
    action: variant === 'original' ? 'file.downloaded' : 'file.viewed',
    entityType: 'file',
    entityId: params.id,
    after: { served_file_id: file.id, variant },
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': file.mime_type,
      'Content-Disposition': `inline; filename="${file.original_filename}"`,
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}
