const { z } = require('zod');

const rfqItemSchema = z.object({
  item_name: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1),
});

const rfqAttachmentSchema = z.object({
  file_id: z.string().min(1),
  type: z.enum(['design', 'certificate', 'other']),
  contains_identity_risk: z.boolean().optional(),
});

// SPEC.md Section 16: only `title` is required to save a DRAFT — the rest is optional here and
// enforced in full by validateRfqForSubmit below, at submit time (see the schema comment in the
// original Prisma model for why: Section 3's table marks more fields required, but Section 16's
// API spec is treated as the more specific, more authoritative statement of intent).
const createRfqSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(150, 'Title must be 150 characters or fewer.'),
  category: z.string().trim().min(1).optional(), // free text — resolved to a real category, find-or-create
  quantity: z.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  dimensions: z.string().trim().max(500).optional(),
  material: z.string().trim().max(500).optional(),
  technical_specs: z.record(z.unknown()).optional(),
  printing_customization: z.string().trim().max(1000).optional(),
  delivery_deadline: z.string().datetime().optional(),
  delivery_region: z.string().trim().min(1).optional(),
  quality_requirements: z.string().trim().max(1000).optional(),
  sample_required: z.boolean().optional(),
  certifications_required: z.string().trim().max(1000).optional(),
  legal_compliance_requirements: z.string().trim().max(1000).optional(),
  offer_deadline_at: z.string().datetime().optional(),
  items: z.array(rfqItemSchema).optional(),
  attachments: z.array(rfqAttachmentSchema).optional(),
});

const updateRfqSchema = createRfqSchema.partial();

/** SPEC.md Section 8.2 — the full required-field set enforced only at submit time. */
function validateRfqForSubmit(rfq) {
  const fields = {};
  if (!rfq.title) fields.title = 'Title is required.';
  if (!rfq.category_id) fields.category = 'Category is required.';
  if (!rfq.quantity) fields.quantity = 'Quantity is required.';
  if (!rfq.unit) fields.unit = 'Unit is required.';
  if (!rfq.delivery_deadline) fields.delivery_deadline = 'Delivery deadline is required.';
  if (!rfq.delivery_region) fields.delivery_region = 'Delivery region is required.';
  if (!rfq.offer_deadline_at) fields.offer_deadline_at = 'Offer deadline is required.';

  if (rfq.offer_deadline_at && rfq.delivery_deadline) {
    const offerDeadline = rfq.offer_deadline_at.toDate ? rfq.offer_deadline_at.toDate() : new Date(rfq.offer_deadline_at);
    const deliveryDeadline = rfq.delivery_deadline.toDate ? rfq.delivery_deadline.toDate() : new Date(rfq.delivery_deadline);
    if (offerDeadline > deliveryDeadline) {
      fields.offer_deadline_at = 'Offer deadline must be on or before the delivery deadline.';
    }
  }

  return fields;
}

module.exports = { createRfqSchema, updateRfqSchema, validateRfqForSubmit };
