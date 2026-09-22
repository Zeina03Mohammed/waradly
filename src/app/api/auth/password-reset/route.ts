import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { passwordResetSchema, zodFieldErrors } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/tokens';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = passwordResetSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const tokenHash = hashToken(parsed.data.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { token_hash: tokenHash } });

  if (!record || record.used || record.expires_at < new Date()) {
    return Errors.invalidToken();
  }

  const password_hash = await hashPassword(parsed.data.new_password);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    // Resetting invalidates all existing sessions for that user (SPEC.md Section 4).
    prisma.refreshToken.updateMany({ where: { user_id: record.user_id }, data: { revoked: true } }),
  ]);

  await audit({ actorId: record.user_id, action: 'auth.password_reset', entityType: 'user', entityId: record.user_id });

  return NextResponse.json({ ok: true }, { status: 200 });
}
