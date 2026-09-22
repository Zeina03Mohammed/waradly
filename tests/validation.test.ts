import { describe, expect, it } from 'vitest';
import { isPasswordValid } from '@/lib/auth/password';
import { validateRfqForSubmit, type RfqSubmitCandidate } from '@/lib/validation/rfq';
import { createOfferSchema } from '@/lib/validation/offer';
import { createRatingSchema } from '@/lib/validation/rating';
import { isAllowedMimeType, MAX_FILE_SIZE_BYTES } from '@/lib/files/constraints';

// SPEC.md Section 17 — core validation rules.

describe('password validation (>= 8 chars, at least 1 letter and 1 number)', () => {
  it.each([
    ['short1', false],
    ['nouppercasebutlong1', true],
    ['NoNumbersHere', false],
    ['12345678', false],
    ['ValidPass1', true],
  ])('%s -> %s', (password, expected) => {
    expect(isPasswordValid(password)).toBe(expected);
  });
});

describe('RFQ submit validation (Section 8.2/17)', () => {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const nearFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  function baseCandidate(overrides: Partial<RfqSubmitCandidate> = {}): RfqSubmitCandidate {
    return {
      category_id: 'cat-1',
      title: 'Custom boxes',
      quantity: 100,
      unit: 'pcs',
      delivery_deadline: future,
      delivery_region: 'Cairo',
      offer_deadline_at: nearFuture,
      printing_customization: null,
      attachmentCount: 0,
      ...overrides,
    };
  }

  it('accepts a fully-populated RFQ', () => {
    expect(validateRfqForSubmit(baseCandidate())).toBeNull();
  });

  it('rejects a missing category', () => {
    expect(validateRfqForSubmit(baseCandidate({ category_id: null }))).toHaveProperty('category_id');
  });

  it('rejects quantity <= 0', () => {
    expect(validateRfqForSubmit(baseCandidate({ quantity: 0 }))).toHaveProperty('quantity');
  });

  it('rejects a delivery deadline in the past', () => {
    expect(validateRfqForSubmit(baseCandidate({ delivery_deadline: past }))).toHaveProperty('delivery_deadline');
  });

  it('rejects an offer deadline in the past', () => {
    expect(validateRfqForSubmit(baseCandidate({ offer_deadline_at: past }))).toHaveProperty('offer_deadline_at');
  });

  it('rejects an offer deadline after the delivery deadline', () => {
    const errors = validateRfqForSubmit(
      baseCandidate({ delivery_deadline: nearFuture, offer_deadline_at: future }),
    );
    expect(errors).toHaveProperty('offer_deadline_at');
  });

  it('requires an attachment when printing_customization is filled', () => {
    const errors = validateRfqForSubmit(baseCandidate({ printing_customization: 'Logo on lid', attachmentCount: 0 }));
    expect(errors).toHaveProperty('attachments');
  });

  it('does not require an attachment when printing_customization is empty', () => {
    expect(validateRfqForSubmit(baseCandidate({ printing_customization: '', attachmentCount: 0 }))).toBeNull();
  });

  it('passes when printing_customization is filled and an attachment exists', () => {
    expect(
      validateRfqForSubmit(baseCandidate({ printing_customization: 'Logo on lid', attachmentCount: 1 })),
    ).toBeNull();
  });
});

describe('Offer validation (Section 9.1/17)', () => {
  const validOffer = {
    unit_price: 1.5,
    moq: 100,
    production_lead_time_days: 10,
    delivery_time_estimate_days: 5,
    sample_availability: false,
  };

  it('accepts a valid offer', () => {
    expect(createOfferSchema.safeParse(validOffer).success).toBe(true);
  });

  it.each(['unit_price', 'moq', 'production_lead_time_days', 'delivery_time_estimate_days'])(
    'rejects %s <= 0',
    (field) => {
      const result = createOfferSchema.safeParse({ ...validOffer, [field]: 0 });
      expect(result.success).toBe(false);
    },
  );

  it('requires sample_terms when sample_availability is true', () => {
    const result = createOfferSchema.safeParse({ ...validOffer, sample_availability: true });
    expect(result.success).toBe(false);
  });

  it('accepts sample_availability true with sample_terms provided', () => {
    const result = createOfferSchema.safeParse({ ...validOffer, sample_availability: true, sample_terms: 'Free sample' });
    expect(result.success).toBe(true);
  });
});

describe('Rating validation (Section 17: score required, integer 1-5)', () => {
  it.each([0, 6, 1.5, -1])('rejects score %s', (score) => {
    expect(createRatingSchema.safeParse({ score }).success).toBe(false);
  });

  it.each([1, 2, 3, 4, 5])('accepts score %s', (score) => {
    expect(createRatingSchema.safeParse({ score }).success).toBe(true);
  });

  it('rejects a comment over 1000 chars', () => {
    const result = createRatingSchema.safeParse({ score: 5, comment: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('File validation (Section 12/17: allowed types, <= 10MB)', () => {
  it.each(['image/png', 'image/jpeg', 'application/pdf'])('allows %s', (mime) => {
    expect(isAllowedMimeType(mime)).toBe(true);
  });

  it.each(['image/gif', 'application/zip', 'text/plain', 'video/mp4'])('rejects %s', (mime) => {
    expect(isAllowedMimeType(mime)).toBe(false);
  });

  it('caps file size at 10MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
