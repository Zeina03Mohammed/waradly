/** Port of src/lib/stateMachines/offer.ts — SPEC.md Section 9. */

const TRANSITIONS = {
  SUBMITTED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

const EDITABLE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];
const OPEN_STATUSES = ['SUBMITTED', 'UNDER_REVIEW']; // "competing" / not-yet-decided offers

function canTransitionOffer(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function isOfferEditable(status) {
  return EDITABLE_STATUSES.includes(status);
}

module.exports = { canTransitionOffer, isOfferEditable, OPEN_STATUSES };
