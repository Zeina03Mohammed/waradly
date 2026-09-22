import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { updateOrganizationSchema } from '@/lib/validation/organization';
import { zodFieldErrors } from '@/lib/validation/auth';
import { toSelfOrganizationView } from '@/lib/masking/organization';
import { audit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier');
  if (denied) return denied;

  const org = await prisma.organization.findFirst({ where: { owner_user_id: auth.user.id } });
  if (!org) return Errors.notFound();

  return NextResponse.json({ organization: toSelfOrganizationView(org) });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'buyer', 'supplier');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = updateOrganizationSchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const org = await prisma.organization.findFirst({ where: { owner_user_id: auth.user.id } });
  if (!org) return Errors.notFound();

  const before = toSelfOrganizationView(org);
  const updated = await prisma.organization.update({ where: { id: org.id }, data: parsed.data });
  const after = toSelfOrganizationView(updated);

  await audit({
    actorId: auth.user.id,
    action: 'organization.updated',
    entityType: 'organization',
    entityId: org.id,
    before,
    after,
  });

  return NextResponse.json({ organization: after });
}
