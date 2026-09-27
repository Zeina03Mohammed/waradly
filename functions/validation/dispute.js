const { z } = require('zod');

const createDisputeSchema = z.object({
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
});

const resolveDisputeSchema = z.object({
  outcome: z.enum(['reopen_production', 'refund_manual', 'close_no_action']),
  notes: z.string().trim().max(2000).optional(),
});

module.exports = { createDisputeSchema, resolveDisputeSchema };
