const { z } = require('zod');

const createConversationSchema = z
  .object({
    rfq_id: z.string().min(1).optional(),
    order_id: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.rfq_id) !== Boolean(data.order_id), {
    message: 'Exactly one of rfq_id or order_id must be set.',
  });

const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty.').max(5000),
});

const flagDecisionSchema = z.object({
  action: z.enum(['dismiss', 'warning', 'strike', 'suspension', 'ban']),
  reason: z.string().trim().max(1000).optional(),
});

module.exports = { createConversationSchema, sendMessageSchema, flagDecisionSchema };
