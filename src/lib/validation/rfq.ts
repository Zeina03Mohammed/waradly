import { z } from 'zod';

const attachmentInputSchema = z.object({
  file_id: z.string().uuid(),
  type: z.enum(['design', 'certificate', 'other']),
  contains_identity_risk: z.boolean().optional().default(false),
});

const rfqItemInputSchema = z.object({
  item_name: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1),
});

// SPEC.md Section 8.2. All optional here — POST /rfqs only requires `title` for a DRAFT save
// (enforced separately), and PATCH /rfqs/{id} allows partial updates.
export const rfqFieldsSchema = z.object({
  // Buyer types this freely (RfqForm) rather than picking from the admin-managed category
  // list — resolved to a real categories row (matched by name, created if new) server-side in
  // the RFQ create/update route, so every downstream category_id consumer (supplier eligibility,
  // distribution, review filters) keeps working unchanged.
  category_name: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1, 'Title is required.').max(150, 'Title must be 150 characters or fewer.').optional(),
  quantity: z.number().positive('Quantity must be greater than 0.').optional(),
  unit: z.string().trim().min(1).optional(),
  dimensions: z.string().trim().max(500).optional(),
  material: z.string().trim().max(200).optional(),
  technical_specs: z.record(z.string()).optional(),
  printing_customization: z.string().trim().max(2000).optional(),
  delivery_deadline: z.coerce.date().optional(),
  delivery_region: z.string().trim().min(1).max(200).optional(),
  quality_requirements: z.string().trim().max(2000).optional(),
  sample_required: z.boolean().optional(),
  certifications_required: z.string().trim().max(2000).optional(),
  legal_compliance_requirements: z.string().trim().max(2000).optional(),
  offer_deadline_at: z.coerce.date().optional(),
  attachments: z.array(attachmentInputSchema).optional(),
  items: z.array(rfqItemInputSchema).optional(),
});

export const createRfqSchema = rfqFieldsSchema.extend({
  title: z.string().trim().min(1, 'Title is required.').max(150, 'Title must be 150 characters or fewer.'),
});

export interface RfqSubmitCandidate {
  category_id: string | null;
  title: string;
  quantity: unknown;
  unit: string | null;
  delivery_deadline: Date | null;
  delivery_region: string | null;
  offer_deadline_at: Date | null;
  printing_customization: string | null;
  attachmentCount: number;
}

/** Full-set validation applied at submit time (SPEC.md Sections 8.2/17). Returns field errors,
 * or null if the RFQ is ready to submit. */
export function validateRfqForSubmit(rfq: RfqSubmitCandidate): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const now = new Date();

  if (!rfq.category_id) errors.category_id = 'Category is required.';
  if (!rfq.title) errors.title = 'Title is required.';
  if (rfq.quantity === null || rfq.quantity === undefined || Number(rfq.quantity) <= 0) {
    errors.quantity = 'Quantity is required and must be greater than 0.';
  }
  if (!rfq.unit) errors.unit = 'Unit is required.';
  if (!rfq.delivery_region) errors.delivery_region = 'Delivery region is required.';

  if (!rfq.delivery_deadline) {
    errors.delivery_deadline = 'Delivery deadline is required.';
  } else if (rfq.delivery_deadline <= now) {
    errors.delivery_deadline = 'Delivery deadline must be a future date.';
  }

  if (!rfq.offer_deadline_at) {
    errors.offer_deadline_at = 'Offer deadline is required.';
  } else if (rfq.offer_deadline_at <= now) {
    errors.offer_deadline_at = 'Offer deadline must be in the future.';
  } else if (rfq.delivery_deadline && rfq.offer_deadline_at > rfq.delivery_deadline) {
    errors.offer_deadline_at = 'Offer deadline must be on or before the delivery deadline.';
  }

  if (rfq.printing_customization && rfq.printing_customization.trim().length > 0 && rfq.attachmentCount === 0) {
    errors.attachments = 'At least one attachment is required when printing/customization is specified.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
