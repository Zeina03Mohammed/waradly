import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storageProvider } from '@/lib/storage';

/** Unauthenticated by design (like any avatar URL — Gravatar, etc.): served straight from an
 * <img> tag, gated only by the user's id being an unguessable UUID. Low-sensitivity by nature,
 * unlike RFQ/offer attachments, so it doesn't go through the signed-URL file pipeline. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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
