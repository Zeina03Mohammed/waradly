import { z } from 'zod';

// SPEC.md Section 17.
const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');
const legalNameSchema = z.string().trim().min(1, 'Company legal name is required.').max(200);
const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required.')
  .regex(/^\+?[0-9()\-\s]{6,20}$/, 'Enter a valid phone number.');
export const usernameSchema = z.string().trim().min(1, 'Username is required.').max(50);

export const registerSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(['buyer', 'supplier']),
  legal_name: legalNameSchema,
  country: z.string().trim().min(1, 'Country is required.'),
  general_region: z.string().trim().min(1, 'General region is required.'),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms, Anti-Circumvention Policy, and Privacy Policy.' }),
  }),
  // Supplier-only: at least one category to apply for (SPEC.md Section 4/6.1).
  category_ids: z.array(z.string().uuid()).optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'supplier' && (!data.category_ids || data.category_ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category_ids'],
      message: 'Select at least one category.',
    });
  }
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  new_password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
