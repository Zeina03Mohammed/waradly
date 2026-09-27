const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(100),
});

const verificationDocumentSchema = z.object({
  file_id: z.string().min(1),
  document_type: z.enum(['commercial_registration', 'certificate', 'other']),
});

const categoryApplicationSchema = z.object({
  category_id: z.string().min(1),
  production_capacity: z.string().trim().max(200).optional(),
  materials_supported: z.array(z.string().trim().min(1)).optional(),
});

const supplierVerificationDecisionSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  rejection_reason: z.string().trim().max(500).optional(),
});

module.exports = { createCategorySchema, verificationDocumentSchema, categoryApplicationSchema, supplierVerificationDecisionSchema };
