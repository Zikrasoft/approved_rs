import { CATEGORY_FIELD_TYPES } from '@podbor/catalog-contract';
import { z } from 'zod';

import { adminImageSchema } from '../components/image-uploads';
import { editedBySchema } from './admin-fetch';

const fieldOptionSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  rank: z.number(),
});

export type FieldOption = z.infer<typeof fieldOptionSchema>;

const categoryFieldSchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(CATEGORY_FIELD_TYPES),
  unit: z.string().nullable(),
  label: z.string(),
  required: z.boolean(),
  facet: z.boolean(),
  rank: z.number(),
  options: z.array(fieldOptionSchema),
});

export type CategoryField = z.infer<typeof categoryFieldSchema>;

const categorySchema = editedBySchema.extend({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  text: z.string(),
  maintenance_kit: z.boolean(),
  kit_rank: z.number(),
  service_label: z.string().nullable(),
  service_price: z.number().nullable(),
  service_note: z.string().nullable(),
  installation_price: z.number().nullable(),
  image: adminImageSchema.nullable(),
  fields: z.array(categoryFieldSchema),
});

export type Category = z.infer<typeof categorySchema>;

export const categoriesSchema = z.object({
  categories: z.array(categorySchema),
});
