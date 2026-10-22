import { z } from 'zod';

import { PART_IDENTIFIER_TYPES } from '../modules/catalog/models/part-identifier';
import type CatalogModuleService from '../modules/catalog/service';
import { adminImage, partImagesSchema } from './images';

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  value: z.string(),
  normalized_value: z.string(),
  superseded: z.boolean(),
  brand: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
});

export const adminPartSchema = z.object({
  id: z.string(),
  name: z.string(),
  category_id: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  images: partImagesSchema.transform(({ items }) => items.map(adminImage)),
  source: z.string(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.date(),
  replaced_by: z.object({ id: z.string(), name: z.string() }).nullable(),
  identifiers: z.array(identifierSchema),
});

export const PART_RELATIONS = [
  'identifiers',
  'identifiers.brand',
  'replaced_by',
];

export const adminPart = async (catalog: CatalogModuleService, id: string) =>
  adminPartSchema.parse(
    await catalog.retrievePart(id, { relations: PART_RELATIONS }),
  );
