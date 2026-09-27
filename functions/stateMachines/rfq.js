/** Port of src/lib/stateMachines/rfq.ts — SPEC.md Section 8. */

const TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['PUBLISHED', 'REJECTED', 'CANCELLED'],
  REJECTED: ['SUBMITTED', 'CANCELLED'],
  PUBLISHED: ['RECEIVING_OFFERS', 'EXPIRED', 'CANCELLED'],
  RECEIVING_OFFERS: ['AWARDED', 'EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
  AWARDED: ['CLOSED'],
  CLOSED: [],
};

// Only these statuses allow editing fields/items/attachments — no partial edits post-publish
// (buyer must cancel + recreate), per SPEC.md Section 8.
const EDITABLE_STATUSES = ['DRAFT', 'SUBMITTED'];

function canTransitionRfq(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function isRfqEditable(status) {
  return EDITABLE_STATUSES.includes(status);
}

module.exports = { canTransitionRfq, isRfqEditable, TRANSITIONS };
