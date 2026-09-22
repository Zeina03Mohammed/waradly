/**
 * Seed script — creates one admin, one active category, and a demo buyer + supplier so the
 * app is usable immediately after `docker compose up && npm run seed`.
 *
 * Demo login (all accounts share this password): Password123
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123';

async function ensureUser(email: string, role: 'admin' | 'buyer' | 'supplier', passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password_hash: passwordHash, role, email_verified_at: new Date() },
  });
}

async function ensureOrganization(
  ownerUserId: string,
  type: 'buyer' | 'supplier',
  legalName: string,
  country: string,
  generalRegion: string,
) {
  const existing = await prisma.organization.findFirst({ where: { owner_user_id: ownerUserId } });
  if (existing) return existing;
  return prisma.organization.create({
    data: { owner_user_id: ownerUserId, type, legal_name: legalName, country, general_region: generalRegion },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Admin — never self-registrable (SPEC.md Section 4), provisioned here instead.
  await ensureUser('admin@wardly.test', 'admin', passwordHash);

  const category = await prisma.category.upsert({
    where: { name: 'Custom Packaging' },
    update: { status: 'active' },
    create: { name: 'Custom Packaging', status: 'active', phase: 1 },
  });

  // Demo buyer.
  const buyerUser = await ensureUser('buyer@wardly.test', 'buyer', passwordHash);
  const buyerOrg = await ensureOrganization(buyerUser.id, 'buyer', 'Acme Importing LLC', 'Egypt', 'Cairo');
  const buyerProfile = await prisma.buyerProfile.upsert({
    where: { organization_id: buyerOrg.id },
    update: {},
    create: { organization_id: buyerOrg.id, verified: true },
  });

  // Demo supplier — verified and approved for the demo category so RFQs are immediately
  // quotable end to end.
  const supplierUser = await ensureUser('supplier@wardly.test', 'supplier', passwordHash);
  const supplierOrg = await ensureOrganization(supplierUser.id, 'supplier', 'Nile Textiles Co.', 'Egypt', 'Alexandria');

  let supplierProfile = await prisma.supplierProfile.findUnique({ where: { organization_id: supplierOrg.id } });
  if (!supplierProfile) {
    supplierProfile = await prisma.supplierProfile.create({
      data: { organization_id: supplierOrg.id, anonymized_id: 'Supplier #1001', verification_status: 'verified' },
    });
  } else if (supplierProfile.verification_status !== 'verified') {
    supplierProfile = await prisma.supplierProfile.update({
      where: { id: supplierProfile.id },
      data: { verification_status: 'verified' },
    });
  }

  await prisma.supplierCategory.upsert({
    where: { supplier_id_category_id: { supplier_id: supplierProfile.id, category_id: category.id } },
    update: { approved: true, approved_at: new Date() },
    create: {
      supplier_id: supplierProfile.id,
      category_id: category.id,
      approved: true,
      approved_at: new Date(),
      production_capacity: '50,000 units/month',
      materials_supported: ['Kraft paper', 'Corrugated board'],
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  // eslint-disable-next-line no-console
  console.log('  Admin:    admin@wardly.test    / ' + DEMO_PASSWORD);
  // eslint-disable-next-line no-console
  console.log('  Buyer:    buyer@wardly.test    / ' + DEMO_PASSWORD, `(org: ${buyerOrg.legal_name}, buyer_profile: ${buyerProfile.id})`);
  // eslint-disable-next-line no-console
  console.log('  Supplier: supplier@wardly.test / ' + DEMO_PASSWORD, `(org: ${supplierOrg.legal_name}, anonymized_id: ${supplierProfile.anonymized_id})`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
