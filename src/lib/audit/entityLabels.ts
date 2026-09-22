import { prisma } from '@/lib/prisma';

/** Human-readable "Type" label for the audit log's entity column, e.g. "supplier_verification"
 * -> "Supplier Verification". */
export function formatEntityType(type: string): string {
  if (type === 'rfq') return 'RFQ';
  return type
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

type LogRef = { entity_type: string; entity_id: string };

/** Best-effort lookup of a readable label per (entity_type, entity_id) pair, batched one query
 * per type so a page of audit logs doesn't fire hundreds of individual lookups. Falls back to
 * null (caller shows the short id) for entity types with no natural display name, or rows whose
 * entity no longer exists. */
export async function buildEntityLabels(logs: LogRef[]): Promise<Map<string, string>> {
  const idsByType = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!idsByType.has(log.entity_type)) idsByType.set(log.entity_type, new Set());
    idsByType.get(log.entity_type)!.add(log.entity_id);
  }

  const labels = new Map<string, string>();
  const set = (type: string, id: string, label: string) => labels.set(`${type}:${id}`, label);

  for (const [type, idSet] of idsByType) {
    const ids = [...idSet];
    switch (type) {
      case 'user': {
        const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
        rows.forEach((r) => set(type, r.id, r.email));
        break;
      }
      case 'organization': {
        const rows = await prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true, legal_name: true } });
        rows.forEach((r) => set(type, r.id, r.legal_name));
        break;
      }
      case 'category': {
        const rows = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        rows.forEach((r) => set(type, r.id, r.name));
        break;
      }
      case 'rfq': {
        const rows = await prisma.rfq.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        rows.forEach((r) => set(type, r.id, r.title));
        break;
      }
      case 'offer': {
        const rows = await prisma.offer.findMany({
          where: { id: { in: ids } },
          select: { id: true, rfq: { select: { title: true } } },
        });
        rows.forEach((r) => set(type, r.id, `Offer on "${r.rfq.title}"`));
        break;
      }
      case 'order': {
        const rows = await prisma.order.findMany({
          where: { id: { in: ids } },
          select: { id: true, rfq: { select: { title: true } } },
        });
        rows.forEach((r) => set(type, r.id, `Order for "${r.rfq.title}"`));
        break;
      }
      case 'file': {
        const rows = await prisma.file.findMany({ where: { id: { in: ids } }, select: { id: true, original_filename: true } });
        rows.forEach((r) => set(type, r.id, r.original_filename));
        break;
      }
      case 'dispute': {
        const rows = await prisma.dispute.findMany({ where: { id: { in: ids } }, select: { id: true, category: true } });
        rows.forEach((r) => set(type, r.id, `Dispute: ${r.category}`));
        break;
      }
      case 'rating': {
        const rows = await prisma.rating.findMany({ where: { id: { in: ids } }, select: { id: true, score: true } });
        rows.forEach((r) => set(type, r.id, `Rating: ${r.score}/5`));
        break;
      }
      case 'supplier_verification': {
        const rows = await prisma.supplierVerification.findMany({
          where: { id: { in: ids } },
          select: { id: true, document_type: true },
        });
        rows.forEach((r) => set(type, r.id, `Verification: ${r.document_type}`));
        break;
      }
      case 'supplier_profile': {
        const rows = await prisma.supplierProfile.findMany({ where: { id: { in: ids } }, select: { id: true, anonymized_id: true } });
        rows.forEach((r) => set(type, r.id, r.anonymized_id));
        break;
      }
      case 'supplier_category': {
        const rows = await prisma.supplierCategory.findMany({
          where: { id: { in: ids } },
          select: { id: true, category: { select: { name: true } } },
        });
        rows.forEach((r) => set(type, r.id, r.category.name));
        break;
      }
      case 'message_flag': {
        const rows = await prisma.messageFlag.findMany({
          where: { id: { in: ids } },
          select: { id: true, detected_pattern_type: true },
        });
        rows.forEach((r) => set(type, r.id, `Flag: ${r.detected_pattern_type}`));
        break;
      }
      case 'message': {
        const rows = await prisma.message.findMany({ where: { id: { in: ids } }, select: { id: true, content: true } });
        rows.forEach((r) => set(type, r.id, r.content.length > 40 ? `${r.content.slice(0, 40)}…` : r.content));
        break;
      }
      default:
        break;
    }
  }

  return labels;
}
