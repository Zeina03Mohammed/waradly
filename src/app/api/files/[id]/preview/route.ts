import { NextRequest, NextResponse } from 'next/server';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { resolveFileAccess } from '@/lib/files/access';
import { createSignedFileUrl } from '@/lib/storage/signedUrl';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const access = await resolveFileAccess(params.id, auth.user.id, 'preview');
  if (!access.allowed) {
    return access.reason === 'not_found' ? Errors.notFound() : Errors.forbidden();
  }

  const url = createSignedFileUrl(params.id, 'preview', auth.user.id);
  return NextResponse.json({ url, expires_in_seconds: 300 });
}
