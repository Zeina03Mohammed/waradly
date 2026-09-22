import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * SPEC.md Section 3 notes the anonymized_id is "generated on approval" but the column is
 * NOT NULL, so a value must exist from row creation. We generate it at supplier_profile
 * creation time and control exposure via verification_status instead (unverified suppliers
 * are never surfaced to buyers or shown in any feed), which preserves the spec's intent
 * without violating the column constraint.
 *
 * Accepts an optional transaction client — callers that generate this inside a
 * prisma.$transaction (e.g. supplier registration) must pass `tx` so the uniqueness check
 * reads through the same transaction rather than a separate connection.
 */
export async function generateAnonymizedId(client: Prisma.TransactionClient | typeof prisma = prisma): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `Supplier #${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await client.supplierProfile.findUnique({ where: { anonymized_id: candidate } });
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate a unique anonymized_id after 20 attempts.');
}
