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

const mixesScripts = (word: string) =>
  /\p{Script=Latin}/u.test(word) && /\p{Script=Cyrillic}/u.test(word);

const russianText = z
  .string()
  .trim()
  .min(1)
  .refine((text) => !(text.match(/\p{L}+/gu) ?? []).some(mixesScripts), {
    error: 'a word mixes Latin and Cyrillic letters',
  });

export const descriptionSchema = z.object({ description: russianText });

export const nameSchema = z.object({ name: russianText });

export type CategoryChoice = { id: string; name: string; text?: string };

export type PlacedPart = { name: string; category: string | null };

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
  writeDescription: (
    article: ArticleFacts,
    placed: PlacedPart,
  ) => Promise<string>;
  writeName: (article: ArticleFacts) => Promise<string>;
};
