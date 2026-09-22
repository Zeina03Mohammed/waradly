import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required.').max(100),
  phase: z.number().int().min(1).optional(),
});

export const applyCategorySchema = z.object({
  category_id: z.string().uuid('Select a category.'),
  production_capacity: z.string().trim().max(500).optional(),
  materials_supported: z.array(z.string().trim().min(1)).optional(),
});

export const approveCategorySchema = z.object({
  approved: z.boolean(),
});
