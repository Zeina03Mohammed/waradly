import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storageProvider } from '@/lib/storage';
import { authenticate } from '@/lib/auth/session';
import { Errors } from '@/lib/http';

/**
 * SECURITY: this was previously unauthenticated on the theory that a UUID user id is
 * unguessable, like a Gravatar URL. That reasoning didn't account for `sender_id` on every
 * message being that same raw user id, visible to the other party in any conversation — so an
 * unauthenticated version of this route let a buyer or supplier fetch their counterpart's real
 * photo straight from a message they received, defeating the identity-masking system this app
 * is built around (SPEC.md Section 11). Restricted to the user themself or Admin; the client
 * fetches it with the bearer token and renders it as a blob URL (see components/Avatar.tsx)
 * instead of a plain <img src> that can't carry an Authorization header.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  if (auth.user.id !== params.id && auth.user.role !== 'admin') {
    return Errors.forbidden();
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { avatar_storage_key: true, avatar_mime_type: true },
  });

  if (!user?.avatar_storage_key || !user.avatar_mime_type) {
    return new NextResponse('Not found', { status: 404 });
  }

  const buffer = await storageProvider.read(user.avatar_storage_key);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': user.avatar_mime_type,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
