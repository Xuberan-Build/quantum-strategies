import { z } from 'zod';

/**
 * Product Step Schema
 */
export const productStepSchema = z.object({
  step: z.number().int().positive(),
  title: z.string().min(1, 'Title is required').max(200),
  subtitle: z.string().max(500).optional().default(''),
  question: z.string().min(1, 'Question is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  allow_file_upload: z.boolean().default(false),
  file_upload_prompt: z.string().optional(),
  required: z.boolean().default(true),
  max_follow_ups: z.number().int().min(0).max(10).default(3),
});

export type ProductStepInput = z.infer<typeof productStepSchema>;

/**
 * Product Instructions Schema
 */
export const productInstructionsSchema = z.object({
  welcome: z.object({
    title: z.string().min(1),
    description: z.string(),
    estimatedTime: z.string(),
    ctaText: z.string(),
  }),
  processing: z.array(z.string()),
  transitions: z.object({
    prefix: z.string(),
    suffix: z.string(),
  }),
  deliverable: z.object({
    title: z.string(),
    description: z.string(),
  }),
}).optional();

/**
 * Product Definition Schema
 */
export const productSchema = z.object({
  product_slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  price: z.number().min(0).optional(),
  total_steps: z.number().int().min(1).max(50),
  estimated_duration: z.string().optional(),
  model: z.string().default('gpt-4'),
  system_prompt: z.string().min(1, 'System prompt is required'),
  final_deliverable_prompt: z.string().min(1, 'Final deliverable prompt is required'),
  steps: z.array(productStepSchema).min(1, 'At least one step is required'),
  instructions: productInstructionsSchema.nullable(),
  is_active: z.boolean().default(true),
  product_group: z.string().optional(),
  display_order: z.number().int().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

/**
 * Product Update Schema (partial)
 */
export const productUpdateSchema = productSchema.partial().extend({
  product_slug: z.string().optional(), // Can't change slug
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/**
 * Product List Query Schema
 */
export const productListQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.enum(['true', 'false', 'all']).optional().default('all'),
  product_group: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
