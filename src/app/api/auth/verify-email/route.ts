import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { verifyEmailSchema, zodFieldErrors } from '@/lib/validation/auth';
import { hashToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = verifyEmailSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { token_hash: tokenHash } });

  if (!record || record.used || record.expires_at < new Date()) {
    return Errors.invalidToken();
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user_id }, data: { email_verified_at: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  await audit({ actorId: record.user_id, action: 'auth.email_verified', entityType: 'user', entityId: record.user_id });

  return NextResponse.json({ ok: true }, { status: 200 });
}
