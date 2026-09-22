import type { RfqStatus } from '@prisma/client';

/** SPEC.md Section 8.1 "Allowed Next Statuses" column, verbatim. */
export const RFQ_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'DRAFT'],
  UNDER_REVIEW: ['PUBLISHED', 'REJECTED'],
  REJECTED: ['SUBMITTED'],
  PUBLISHED: ['RECEIVING_OFFERS', 'EXPIRED', 'CANCELLED'],
  RECEIVING_OFFERS: ['AWARDED', 'EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
  AWARDED: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionRfq(from: RfqStatus, to: RfqStatus): boolean {
  return RFQ_TRANSITIONS[from]?.includes(to) ?? false;
}
