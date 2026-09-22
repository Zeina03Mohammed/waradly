import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/http';
import { authenticate, requireRole } from '@/lib/auth/session';
import { createCategorySchema } from '@/lib/validation/category';
import { zodFieldErrors } from '@/lib/validation/auth';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const denied = requireRole(auth.user, 'admin');
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json) return Errors.validation({ _: 'Invalid JSON body.' });
  const parsed = createCategorySchema.safeParse(json);
  if (!parsed.success) return Errors.validation(zodFieldErrors(parsed.error));

  const existing = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (existing) return Errors.conflict('A category with this name already exists.');

  const category = await prisma.category.create({
    data: { name: parsed.data.name, phase: parsed.data.phase ?? 1 },
  });

  await audit({ actorId: auth.user.id, action: 'category.created', entityType: 'category', entityId: category.id, after: category });

  return NextResponse.json({ category }, { status: 201 });
}
