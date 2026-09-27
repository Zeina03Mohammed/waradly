const { z } = require('zod');

const adminStatusTransitionSchema = z.object({
  status: z.enum([
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
  ]),
  reason: z.string().trim().min(1, 'A reason is required for admin-forced transitions.'),
  evidence_file_id: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
});

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const sampleDecisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});

module.exports = { adminStatusTransitionSchema, ratingSchema, sampleDecisionSchema };
