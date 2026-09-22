import type { OrderStatus } from '@prisma/client';

/**
 * SPEC.md Section 10.1/10.2 "Allowed Next" column. Additional required-conditions that the
 * table calls out (sample_required gating SAMPLE_REVIEW, evidence required for
 * RECEIVED_AT_HUB/QC_COMPLETED/DELIVERED, actor restrictions, cancellation cutoffs) are
 * enforced separately at the call site — this table only encodes which status pairs are
 * structurally reachable at all.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  OFFER_SELECTED: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PRODUCTION', 'CANCELLED'],
  PRODUCTION: ['SAMPLE_REVIEW', 'PRODUCTION_COMPLETED', 'DISPUTED'],
  SAMPLE_REVIEW: ['PRODUCTION', 'DISPUTED'],
  PRODUCTION_COMPLETED: ['RECEIVED_AT_HUB', 'DISPUTED'],
  RECEIVED_AT_HUB: ['QC_COMPLETED', 'DISPUTED'],
  QC_COMPLETED: ['READY_FOR_DELIVERY', 'DISPUTED'],
  READY_FOR_DELIVERY: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  // DISPUTED's two branches: reopen_production -> PRODUCTION, refund_manual/close_no_action -> CANCELLED.
  DISPUTED: ['PRODUCTION', 'CANCELLED'],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses at which the evidence_file_id (or a note) is required — SPEC.md Section 10.1. */
export const EVIDENCE_REQUIRED_STATUSES: OrderStatus[] = ['RECEIVED_AT_HUB', 'QC_COMPLETED', 'DELIVERED'];
