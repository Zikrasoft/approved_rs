import {
  type AttributeValues,
  attributeValuesSchema,
  type CategoryFieldType,
} from '@podbor/catalog-contract';
import { z } from 'zod';

export const SHOP_AI_REGISTRATION = 'shopAi';

export const quoteReadingSchema = z.object({
  vin: z.string().trim().min(1).nullable(),
  vehicle: z.string().trim().min(1).nullable(),
  lines: z.array(
    z.object({
      name: z.string().trim().min(1),
      number: z.string().trim().min(1),
      quantity: z.number().int().positive(),
      brand: z.string().trim().min(1).nullable(),
      brand_confidence: z.number().min(0).max(1),
      category_id: z.string().nullable(),
    }),
  ),
});

export type QuoteReading = z.infer<typeof quoteReadingSchema>;

export const categoryPickSchema = z.object({
  category_id: z.string().nullable(),
});

export const specsMappingSchema = z.object({
  attributes: attributeValuesSchema,
});

export const descriptionSchema = z.object({
  description: z.string().trim().min(1),
});

export type CategoryChoice = { id: string; name: string };

export type CategoryFieldChoice = {
  key: string;
  label: string;
  type: CategoryFieldType;
  unit: string | null;
  required: boolean;
  options: { key: string; label: string }[];
};

export type ArticleFacts = {
  name: string;
  brand: string;
  number: string;
  description: string | null;
  specs: Record<string, string>;
};

export type ShopAi = {
  readQuote: (
    pdf: Buffer,
    categories: CategoryChoice[],
  ) => Promise<QuoteReading>;
  pickCategory: (
    article: ArticleFacts,
    categories: CategoryChoice[],
  ) => Promise<string | null>;
  mapSpecs: (
    specs: Record<string, string>,
    fields: CategoryFieldChoice[],
  ) => Promise<AttributeValues>;
  writeDescription: (article: ArticleFacts) => Promise<string>;
};
