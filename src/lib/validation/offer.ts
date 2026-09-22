import { z } from 'zod';

const offerAttachmentSchema = z.object({
  file_id: z.string().uuid(),
  type: z.enum(['certificate', 'photo', 'other']),
});

// SPEC.md Section 9.1.
export const createOfferSchema = z
  .object({
    unit_price: z.number().positive('Unit price must be greater than 0.'),
    moq: z.number().positive('MOQ must be greater than 0.'),
    production_lead_time_days: z.number().int().positive('Production lead time must be greater than 0.'),
    delivery_time_estimate_days: z.number().int().positive('Delivery time estimate must be greater than 0.'),
    shipping_estimate_notes: z.string().trim().max(1000).optional(),
    sample_availability: z.boolean().optional().default(false),
    sample_terms: z.string().trim().max(1000).optional(),
    payment_terms: z.string().trim().max(1000).optional(),
    technical_specs_notes: z.string().trim().max(2000).optional(),
    quality_notes: z.string().trim().max(2000).optional(),
    attachments: z.array(offerAttachmentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sample_availability && !data.sample_terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sample_terms'],
        message: 'Sample terms are required when samples are available.',
      });
    }
  });

export const updateOfferSchema = z
  .object({
    unit_price: z.number().positive().optional(),
    moq: z.number().positive().optional(),
    production_lead_time_days: z.number().int().positive().optional(),
    delivery_time_estimate_days: z.number().int().positive().optional(),
    shipping_estimate_notes: z.string().trim().max(1000).optional(),
    sample_availability: z.boolean().optional(),
    sample_terms: z.string().trim().max(1000).optional(),
    payment_terms: z.string().trim().max(1000).optional(),
    technical_specs_notes: z.string().trim().max(2000).optional(),
    quality_notes: z.string().trim().max(2000).optional(),
    attachments: z.array(offerAttachmentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sample_availability === true && !data.sample_terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sample_terms'],
        message: 'Sample terms are required when samples are available.',
      });
    }
  });
