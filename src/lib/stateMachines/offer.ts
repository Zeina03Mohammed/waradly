import type { OfferStatus } from '@prisma/client';

/** SPEC.md Section 9.2. UNDER_REVIEW is a system-only synonym of SUBMITTED for validation
 * purposes — no separate action moves an offer into it, but both share the same allowed-next
 * set except that only SUBMITTED can still go back... actually neither goes back; both share
 * the same terminal targets. */
export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN', 'EXPIRED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** SPEC.md Section 9.2: SUBMITTED and UNDER_REVIEW are treated as the same state for editing/
 * withdrawal eligibility purposes. */
export function isOfferEditable(status: OfferStatus): boolean {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW';
}
