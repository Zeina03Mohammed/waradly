const { z } = require('zod');

const offerItemSchema = z.object({
  rfq_item_id: z.string().min(1).optional(),
  description: z.string().trim().min(1),
  unit_price: z.number().nonnegative(),
  quantity: z.number().positive(),
});

const offerAttachmentSchema = z.object({
  file_id: z.string().min(1),
  type: z.enum(['certificate', 'photo', 'other']),
});

const createOfferSchema = z.object({
  unit_price: z.number().positive('Unit price must be greater than zero.'),
  moq: z.number().positive('MOQ must be greater than zero.'),
  production_lead_time_days: z.number().int().nonnegative(),
  delivery_time_estimate_days: z.number().int().nonnegative(),
  shipping_estimate_notes: z.string().trim().max(1000).optional(),
  sample_availability: z.boolean().optional(),
  sample_terms: z.string().trim().max(1000).optional(),
  payment_terms: z.string().trim().max(1000).optional(),
  technical_specs_notes: z.string().trim().max(1000).optional(),
  quality_notes: z.string().trim().max(1000).optional(),
  items: z.array(offerItemSchema).optional(),
  attachments: z.array(offerAttachmentSchema).optional(),
});

const updateOfferSchema = createOfferSchema.partial();

module.exports = { createOfferSchema, updateOfferSchema };
