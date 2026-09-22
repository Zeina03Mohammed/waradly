import type { Order, OrderStatusHistory, Rating } from '@prisma/client';
import {
  toAdminOrganizationView,
  toPublicOrganizationView,
  toPublicSupplierView,
  type OrganizationRecord,
  type SupplierProfileRecord,
} from '@/lib/masking/organization';

export type OrderViewer = 'buyer' | 'supplier' | 'admin';

interface SerializeOrderArgs {
  viewer: OrderViewer;
  order: Order;
  rfqTitle: string;
  offerSummary: { unit_price: unknown; moq: unknown };
  buyerOrg: OrganizationRecord & { owner_user_id: string };
  supplierOrg: OrganizationRecord & { owner_user_id: string };
  supplierProfile: SupplierProfileRecord;
  statusHistory?: OrderStatusHistory[];
  rating?: Rating | null;
}

/**
 * An Order is the one place a buyer's logo becomes visible to the counterpart (SPEC.md
 * Section 11's only identity exception, "once an Order exists ... for production purposes") —
 * so the supplier's view of the buyer org here passes includeLogo: true, unlike anywhere else
 * a buyer org is rendered.
 */
export function serializeOrder({
  viewer,
  order,
  rfqTitle,
  offerSummary,
  buyerOrg,
  supplierOrg,
  supplierProfile,
  statusHistory,
  rating,
}: SerializeOrderArgs) {
  const base = {
    id: order.id,
    rfq_id: order.rfq_id,
    rfq_title: rfqTitle,
    offer: { unit_price: offerSummary.unit_price, moq: offerSummary.moq },
    status: order.status,
    sample_required: order.sample_required,
    created_at: order.created_at,
    status_history: statusHistory?.map((h) => ({
      id: h.id,
      from_status: h.from_status,
      to_status: h.to_status,
      note: h.note,
      evidence_file_id: h.evidence_file_id,
      changed_at: h.changed_at,
    })),
    rating: rating ? { score: rating.score, comment: rating.comment, created_at: rating.created_at } : null,
  };

  if (viewer === 'buyer') {
    return { ...base, supplier: toPublicSupplierView(supplierOrg, supplierProfile) };
  }
  if (viewer === 'supplier') {
    return { ...base, buyer: toPublicOrganizationView(buyerOrg, { includeLogo: true }) };
  }
  return {
    ...base,
    admin_notes: order.admin_notes,
    buyer: toAdminOrganizationView(buyerOrg),
    supplier: { ...toAdminOrganizationView(supplierOrg), anonymized_id: supplierProfile.anonymized_id },
  };
}
