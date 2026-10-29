import {
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

const mixesScripts = (word: string) =>
  /\p{Script=Latin}/u.test(word) && /\p{Script=Cyrillic}/u.test(word);

const CYRILLIC_TWIN: Record<string, string> = Object.fromEntries(
  [...'aceopxyABCEHKMOPTX'].map((latin, at) => [
    latin,
    'асеорхуАВСЕНКМОРТХ'[at]!,
  ]),
);

const inCyrillic = (word: string) => {
  const repaired = word.replace(
    /\p{Script=Latin}/gu,
    (letter) => CYRILLIC_TWIN[letter] ?? letter,
  );
  return mixesScripts(repaired) ? word : repaired;
};

const wordsOf = (text: string) => text.match(/\p{L}+/gu) ?? [];

const russianText = z
  .string()
  .trim()
  .min(1)
  .transform((text) =>
    text.replace(/\p{L}+/gu, (word) =>
      mixesScripts(word) ? inCyrillic(word) : word,
    ),
  )
  .refine((text) => !wordsOf(text).some(mixesScripts), {
    error: ({ input }) =>
      `a word mixes Latin and Cyrillic letters: ${wordsOf(String(input)).filter(mixesScripts).join(', ')}`,
  });

const valuesThatFit = z
  .record(z.string(), z.unknown())
  .transform((values) =>
    attributeValuesSchema.parse(
      Object.fromEntries(
        Object.entries(values).filter(
          ([key, value]) =>
            attributeValuesSchema.safeParse({ [key]: value }).success,
        ),
      ),
    ),
  );

export const articleAnswerSchema = z.object({
  name: russianText,
  category_id: z.string().nullable(),
  attributes: valuesThatFit,
  description: russianText.nullable(),
});

export type ArticleAnswer = z.infer<typeof articleAnswerSchema>;

export type CategoryFieldChoice = {
  key: string;
  label: string;
  type: CategoryFieldType;
  unit: string | null;
  required: boolean;
  options: { key: string; label: string }[];
};

export type CategoryChoice = {
  id: string;
  name: string;
  text?: string;
  fields?: CategoryFieldChoice[];
};

export type ArticleFacts = {
  name: string;
  brand: string;
  number: string;
  description: string | null;
  specs: Record<string, string>;
  fits: string[];
};

export type ArticleInput = ArticleFacts & { category_id: string | null };

export type ArticleQuestion = {
  model: string;
  system: string;
  user: string;
  categoryIds: string[];
};

export type ShopAi = {
  readQuote: (
    pdf: Buffer,
    categories: CategoryChoice[],
  ) => Promise<QuoteReading>;
  articleQuestion: (
    article: ArticleInput,
    categories: CategoryChoice[],
  ) => ArticleQuestion;
  answerArticle: (question: ArticleQuestion) => Promise<ArticleAnswer>;
};
