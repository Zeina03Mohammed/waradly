import { prisma } from '@/lib/prisma';

export async function getBuyerProfileForUser(userId: string) {
  const org = await prisma.organization.findFirst({
    where: { owner_user_id: userId, type: 'buyer' },
    include: { buyer_profile: true },
  });
  return org?.buyer_profile ?? null;
}

export async function getSupplierProfileForUser(userId: string) {
  const org = await prisma.organization.findFirst({
    where: { owner_user_id: userId, type: 'supplier' },
    include: { supplier_profile: true },
  });
  return org?.supplier_profile ?? null;
}
