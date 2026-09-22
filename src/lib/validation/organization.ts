import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  legal_name: z.string().trim().min(1, 'Company legal name is required.').max(200).optional(),
  country: z.string().trim().min(1, 'Country is required.').optional(),
  general_region: z.string().trim().min(1, 'General region is required.').optional(),
  tax_id: z.string().trim().max(100).nullable().optional(),
  exact_address: z.string().trim().max(500).nullable().optional(),
});
