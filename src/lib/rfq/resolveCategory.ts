import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * The buyer types a category name freely (RfqForm) instead of picking from the admin-managed
 * list. This resolves that text to a real categories row — matching an existing one
 * case-insensitively, or creating a new one (status: coming_soon, same default as an
 * admin-created category) if it doesn't exist yet. Keeps rfqs.category_id as a real FK, so
 * supplier eligibility/distribution/review filters never have to know the buyer didn't pick
 * from a dropdown.
 */
export async function resolveCategoryIdFromName(
  client: Prisma.TransactionClient | typeof prisma,
  name: string | undefined,
): Promise<string | undefined> {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const existing = await client.category.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
  if (existing) return existing.id;

  try {
    const created = await client.category.create({ data: { name: trimmed, status: 'coming_soon', phase: 1 } });
    return created.id;
  } catch {
    // Race: another request created the same (case-insensitive) name between our lookup and
    // create. Read it back rather than surfacing a raw unique-constraint error to the buyer.
    const raced = await client.category.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' } } });
    if (raced) return raced.id;
    throw new Error(`Could not resolve category "${trimmed}".`);
  }
}
