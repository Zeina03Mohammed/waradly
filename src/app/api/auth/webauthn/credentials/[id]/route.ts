import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const credential = await prisma.webAuthnCredential.findUnique({ where: { id: params.id } });
  if (!credential || credential.user_id !== auth.user.id) return Errors.notFound();

  await prisma.webAuthnCredential.delete({ where: { id: credential.id } });
  await audit({ actorId: auth.user.id, action: 'auth.webauthn_removed', entityType: 'user', entityId: auth.user.id, before: { credential_id: credential.id } });

  return new NextResponse(null, { status: 204 });
}
