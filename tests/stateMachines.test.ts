import { describe, expect, it } from 'vitest';
import type { RfqStatus, OfferStatus, OrderStatus } from '@prisma/client';
import { RFQ_TRANSITIONS, canTransitionRfq } from '@/lib/stateMachines/rfq';
import { OFFER_TRANSITIONS, canTransitionOffer } from '@/lib/stateMachines/offer';
import { ORDER_TRANSITIONS, canTransitionOrder } from '@/lib/stateMachines/order';

const RFQ_STATUSES: RfqStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REJECTED',
  'PUBLISHED',
  'RECEIVING_OFFERS',
  'EXPIRED',
  'CANCELLED',
  'AWARDED',
  'CLOSED',
];

const OFFER_STATUSES: OfferStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'];

const ORDER_STATUSES: OrderStatus[] = [
  'OFFER_SELECTED',
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PRODUCTION',
  'SAMPLE_REVIEW',
  'PRODUCTION_COMPLETED',
  'RECEIVED_AT_HUB',
  'QC_COMPLETED',
  'READY_FOR_DELIVERY',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
];

/** Exhaustively checks every (from, to) pair for a state machine: the pairs listed in
 * `allowed` must transition successfully, and every other pair — the full complement — must
 * be rejected. This is the "every invalid transition must be rejected" coverage the project
 * requires, not just a handful of positive examples. */
function exhaustiveCheck<S extends string>(
  statuses: S[],
  allowed: Record<S, S[]>,
  check: (from: S, to: S) => boolean,
) {
  for (const from of statuses) {
    for (const to of statuses) {
      const expected = allowed[from]?.includes(to) ?? false;
      expect(check(from, to), `${from} -> ${to} should be ${expected ? 'allowed' : 'rejected'}`).toBe(expected);
    }
  }
}

describe('RFQ state machine (SPEC.md Section 8.1)', () => {
  it('allows exactly the transitions in the spec’s table and rejects every other pair', () => {
    exhaustiveCheck(RFQ_STATUSES, RFQ_TRANSITIONS, canTransitionRfq);
  });

  it('rejects skipping the admin review gate', () => {
    expect(canTransitionRfq('SUBMITTED', 'PUBLISHED')).toBe(false);
    expect(canTransitionRfq('DRAFT', 'PUBLISHED')).toBe(false);
  });

  it('rejects re-entering a terminal state', () => {
    for (const terminal of ['EXPIRED', 'CANCELLED', 'CLOSED'] as RfqStatus[]) {
      for (const target of RFQ_STATUSES) {
        expect(canTransitionRfq(terminal, target)).toBe(false);
      }
    }
  });
});

describe('Offer state machine (SPEC.md Section 9.2)', () => {
  it('allows exactly the transitions in the spec’s table and rejects every other pair', () => {
    exhaustiveCheck(OFFER_STATUSES, OFFER_TRANSITIONS, canTransitionOffer);
  });

  it('rejects editing/transitioning a decided offer', () => {
    for (const terminal of ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'] as OfferStatus[]) {
      for (const target of OFFER_STATUSES) {
        expect(canTransitionOffer(terminal, target)).toBe(false);
      }
    }
  });
});

describe('Order state machine (SPEC.md Section 10.1/10.2)', () => {
  it('allows exactly the transitions in the spec’s table and rejects every other pair', () => {
    exhaustiveCheck(ORDER_STATUSES, ORDER_TRANSITIONS, canTransitionOrder);
  });

  it('rejects forward-skipping stages (explicit spec example)', () => {
    expect(canTransitionOrder('PAYMENT_CONFIRMED', 'PRODUCTION_COMPLETED')).toBe(false);
    expect(canTransitionOrder('OFFER_SELECTED', 'PRODUCTION')).toBe(false);
    expect(canTransitionOrder('RECEIVED_AT_HUB', 'READY_FOR_DELIVERY')).toBe(false);
  });

  it('rejects any transition out of a fully terminal state', () => {
    for (const target of ORDER_STATUSES) {
      expect(canTransitionOrder('COMPLETED', target)).toBe(false);
      expect(canTransitionOrder('CANCELLED', target)).toBe(false);
    }
  });

  it('allows both DISPUTED resolution branches and nothing else', () => {
    expect(canTransitionOrder('DISPUTED', 'PRODUCTION')).toBe(true); // reopen_production
    expect(canTransitionOrder('DISPUTED', 'CANCELLED')).toBe(true); // refund_manual / close_no_action
    expect(canTransitionOrder('DISPUTED', 'DELIVERED')).toBe(false);
  });
});
