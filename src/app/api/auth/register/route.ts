import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { registerSchema, zodFieldErrors } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { generateRawToken, hashToken } from '@/lib/auth/tokens';
import { generateAnonymizedId } from '@/lib/anonymizedId';
import { toSelfUserView } from '@/lib/masking/user';
import { toSelfOrganizationView } from '@/lib/masking/organization';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications/notify';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // implementation default, not a spec'd business rule

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });

  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return Errors.validation(zodFieldErrors(parsed.error));
  }
  const data = parsed.data;

  if (data.role === 'supplier' && data.category_ids && data.category_ids.length > 0) {
    const found = await prisma.category.findMany({ where: { id: { in: data.category_ids } } });
    if (found.length !== data.category_ids.length) {
      return Errors.validation({ category_ids: 'One or more selected categories do not exist.' });
    }
  }

  const password_hash = await hashPassword(data.password);
  const rawVerificationToken = generateRawToken();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, password_hash, role: data.role },
      });

      const organization = await tx.organization.create({
        data: {
          owner_user_id: user.id,
          type: data.role,
          legal_name: data.legal_name,
          country: data.country,
          general_region: data.general_region,
        },
      });

      if (data.role === 'buyer') {
        await tx.buyerProfile.create({ data: { organization_id: organization.id } });
      } else {
        const anonymized_id = await generateAnonymizedId();
        const supplierProfile = await tx.supplierProfile.create({
          data: { organization_id: organization.id, anonymized_id },
        });
        if (data.category_ids && data.category_ids.length > 0) {
          await tx.supplierCategory.createMany({
            data: data.category_ids.map((category_id) => ({
              supplier_id: supplierProfile.id,
              category_id,
            })),
          });
        }
      }

      await tx.emailVerificationToken.create({
        data: {
          user_id: user.id,
          token_hash: hashToken(rawVerificationToken),
          expires_at: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });

      await audit(
        { actorId: user.id, action: 'auth.registered', entityType: 'user', entityId: user.id, after: { role: user.role, email: user.email } },
        tx,
      );

      return { user, organization };
    });

    const verifyLink = `${process.env.APP_BASE_URL ?? ''}/verify-email?token=${rawVerificationToken}`;
    await notify({
      userId: result.user.id,
      eventType: 'account.created',
      message: 'Welcome to Wardly — please verify your email to get started.',
      link: '/verify-email',
      email: {
        to: result.user.email,
        subject: 'Welcome to Wardly — verify your email',
        body: `Welcome to Wardly!\n\nPlease verify your email by visiting:\n${verifyLink}\n\nThis link expires in 24 hours.`,
      },
    });

    return NextResponse.json(
      {
        user: toSelfUserView(result.user),
        organization: toSelfOrganizationView(result.organization),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return Errors.duplicateEmail();
    }
    throw err;
  }
}
