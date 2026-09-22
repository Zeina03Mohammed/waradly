import { z } from 'zod';

export const reviewSupplierVerificationSchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'rejected' && !data.reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'A reason is required to reject.' });
    }
  });
