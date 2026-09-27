/** Port of src/lib/stateMachines/order.ts — SPEC.md Section 10. Admin's generic status route can
 * force any of these (even ones a normal actor route never triggers) but must always audit-log
 * with a reason — see adminOrders.routes.js. */

const TRANSITIONS = {
  OFFER_SELECTED: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PRODUCTION', 'CANCELLED'],
  PRODUCTION: ['SAMPLE_REVIEW', 'PRODUCTION_COMPLETED', 'CANCELLED', 'DISPUTED'],
  SAMPLE_REVIEW: ['PRODUCTION', 'DISPUTED'], // approve -> back to PRODUCTION, reject -> DISPUTED
  PRODUCTION_COMPLETED: ['RECEIVED_AT_HUB', 'DISPUTED'],
  RECEIVED_AT_HUB: ['QC_COMPLETED', 'DISPUTED'],
  QC_COMPLETED: ['READY_FOR_DELIVERY', 'DISPUTED'],
  READY_FOR_DELIVERY: ['IN_TRANSIT', 'DISPUTED'],
  IN_TRANSIT: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['PRODUCTION', 'CANCELLED'], // dispute-resolve outcomes (phase 8)
};

const EVIDENCE_REQUIRED_STATUSES = ['RECEIVED_AT_HUB', 'QC_COMPLETED', 'DELIVERED'];

function canTransitionOrder(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

module.exports = { canTransitionOrder, EVIDENCE_REQUIRED_STATUSES, TRANSITIONS };
