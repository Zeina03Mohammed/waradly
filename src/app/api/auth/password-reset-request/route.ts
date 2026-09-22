import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { passwordResetRequestSchema, zodFieldErrors } from '@/lib/validation/auth';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';
import { notify } from '@/lib/notifications/notify';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, per SPEC.md Section 4.

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = passwordResetRequestSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always 200, regardless of whether the account exists — SPEC.md Section 16 (no email enumeration).
  if (user) {
    const rawToken = generateRawToken();
    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: hashToken(rawToken),
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetLink = `${process.env.APP_BASE_URL ?? ''}/reset-password?token=${rawToken}`;
    await notify({
      userId: user.id,
      eventType: 'auth.password_reset_requested',
      message: 'A password reset was requested for your account.',
      email: {
        to: user.email,
        subject: 'Reset your Waradly password',
        body: `A password reset was requested for your account.\n\nReset your password: ${resetLink}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email.`,
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
