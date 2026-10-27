import { MedusaError } from '@medusajs/framework/utils';
import { CARLAB } from '@podbor/brands';
import OpenAI from 'openai';
import { z } from 'zod';

import { adminError, type AdminErrorCode } from '../admin-errors';
import {
  type ArticleFacts,
  type CategoryChoice,
  type CategoryFieldChoice,
  categoryPickSchema,
  descriptionSchema,
  nameSchema,
  quoteReadingSchema,
  type ShopAi,
  specsMappingSchema,
} from './contract';

const MODEL = 'gpt-4o';
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 1;

const categoryList = (categories: CategoryChoice[]) =>
  categories.map(({ id, name }) => `${id}: ${name}`).join('\n') || '(none)';

const quotePrompt = (
  categories: CategoryChoice[],
) => `You read a Workshop quote of ${CARLAB.name}, a car service in Belgrade, Serbia: a Serbian «ponuda» PDF for one car, with its VIN, make and model, and lines of parts each with a name, a catalogue number, a quantity and a price. The quote has no brand column.

Answer with one JSON object and nothing else:
{
  "vin": string or null,
  "vehicle": string or null,
  "lines": [
    {
      "name": string,
      "number": string,
      "quantity": positive integer,
      "brand": string or null,
      "brand_confidence": number from 0 to 1,
      "category_id": string or null
    }
  ]
}

Rules:
- "vin" is the 17-character VIN exactly as printed, or null when the quote has none.
- "vehicle" is the make and model text as printed, or null.
- One entry in "lines" per part line. Skip labour, services and totals.
- "number" is the catalogue number exactly as printed.
- "brand" is the manufacturer the catalogue number belongs to, judged from its format (for example "HU 816 x" is MANN-FILTER, an 11-digit number starting with 1 or 3 is BMW original). Use null when you cannot tell.
- "brand_confidence" is how sure you are of "brand": 0.9 or more only when the number format is unmistakable, 0 when "brand" is null.
- "category_id" is the id of the one category below the part belongs to, or null when none fits. Never invent an id.
- Never return prices, sums, discounts or VAT.

Categories (id: name):
${categoryList(categories)}`;

const categoryPrompt = (
  categories: CategoryChoice[],
) => `You file a car part from a supplier's catalogue into the parts catalogue of ${CARLAB.name}, a car service in Belgrade, Serbia. The user message is the part as JSON: its name, brand, number, the supplier's description and its raw specs.

Answer with one JSON object and nothing else: { "category_id": string or null }

"category_id" is the id of the one category below the part belongs to, or null when none fits exactly. Never invent an id.

Categories (id: name):
${categoryList(categories)}`;

const specsPrompt = (
  fields: CategoryFieldChoice[],
) => `You map a car part's raw specs, as a supplier's catalogue writes them (name to value, often in Serbian or English), to the fields of its category. The user message is the specs as JSON.

Answer with one JSON object and nothing else: { "attributes": { field key: value } }

Rules:
- Use only the field keys below, each at most once. Leave a field out when no spec gives its value.
- "number": a non-negative JSON number in the field's unit, converted when the spec uses another unit.
- "boolean": true or false.
- "text": a short string.
- "single-select": the key of one option. "multi-select": a non-empty array of distinct option keys.
- Never guess a value no spec states.

Fields:
${JSON.stringify(fields)}`;

const descriptionPrompt = `You write the Russian description of a car part for its page in the online parts catalogue of ${CARLAB.name}, a car service in Belgrade, Serbia. The user message is the part as JSON: its name, brand, number, the supplier's description and its raw specs.

Answer with one JSON object and nothing else: { "description": string }

Rules:
- Two to four short paragraphs of plain Russian text separated by a blank line, no markdown, no HTML, no lists.
- Use only facts the input states: what the part is, what it does, its key specs. Rewrite in your own words, never copy the supplier's sentences.
- No prices, stock, delivery, the supplier's name, marketing superlatives or guarantees.
- Never use the Cyrillic letter yo (U+0451), write «е» instead. Never use the em dash (U+2014).`;

const namePrompt = `You write the Russian name of a car part for its page in the online parts catalogue of ${CARLAB.name}, a car service in Belgrade, Serbia. The user message is the part as JSON: the supplier's name for it (often in Serbian or English), its brand, number, the supplier's description and its raw specs.

Answer with one JSON object and nothing else: { "name": string }

Rules:
- The part type in Russian as a parts shop names it, with a lowercase rest, then the brand and the number exactly as given, e.g. «Масляный фильтр MANN-FILTER HU 816 x».
- Add a short qualifier only when the input states it and it tells parts of one type apart (e.g. «передний», «с прокладкой»).
- No marketing words, no vehicle names, no prices.
- Never use the Cyrillic letter yo (U+0451), write «е» instead. Never use the em dash (U+2014).`;

const unreadable = (code: AdminErrorCode, what: string, detail: string) =>
  adminError(
    MedusaError.Types.INVALID_DATA,
    code,
    `${what} could not be read: ${detail}`,
  );

type Ask<T> = {
  apiKey: string | undefined;
  system: string;
  user: OpenAI.Chat.ChatCompletionUserMessageParam['content'];
  schema: z.ZodType<T>;
  code: AdminErrorCode;
  what: string;
};

const ask = async <T>({
  apiKey,
  system,
  user,
  schema,
  code,
  what,
}: Ask<T>): Promise<T> => {
  if (!apiKey) {
    throw adminError(
      MedusaError.Types.NOT_ALLOWED,
      'AI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not set',
    );
  }
  const client = new OpenAI({
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw unreadable(code, what, 'the answer is empty');
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw unreadable(code, what, 'the answer is not JSON');
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw unreadable(code, what, z.prettifyError(parsed.error));
  }
  return parsed.data;
};

const articleJson = (article: ArticleFacts) => JSON.stringify(article);

const inHouseStyle = (text: string) =>
  text.replaceAll('ё', 'е').replaceAll('Ё', 'Е').replaceAll('—', '-');

export const openAiShopAi = (apiKey: string | undefined): ShopAi => ({
  readQuote: (pdf, categories) =>
    ask({
      apiKey,
      system: quotePrompt(categories),
      user: [
        {
          type: 'file',
          file: {
            filename: 'ponuda.pdf',
            file_data: `data:application/pdf;base64,${pdf.toString('base64')}`,
          },
        },
      ],
      schema: quoteReadingSchema,
      code: 'QUOTE_UNREADABLE',
      what: 'The Workshop quote',
    }),
  pickCategory: async (article, categories) => {
    const { category_id } = await ask({
      apiKey,
      system: categoryPrompt(categories),
      user: articleJson(article),
      schema: categoryPickSchema,
      code: 'ARTICLE_UNREADABLE',
      what: 'The Category pick',
    });
    return categories.some(({ id }) => id === category_id) ? category_id : null;
  },
  mapSpecs: async (specs, fields) =>
    (
      await ask({
        apiKey,
        system: specsPrompt(fields),
        user: JSON.stringify(specs),
        schema: specsMappingSchema,
        code: 'ARTICLE_UNREADABLE',
        what: 'The specs mapping',
      })
    ).attributes,
  writeDescription: async (article) =>
    inHouseStyle(
      (
        await ask({
          apiKey,
          system: descriptionPrompt,
          user: articleJson(article),
          schema: descriptionSchema,
          code: 'ARTICLE_UNREADABLE',
          what: 'The description',
        })
      ).description,
    ),
  writeName: async (article) =>
    inHouseStyle(
      (
        await ask({
          apiKey,
          system: namePrompt,
          user: articleJson(article),
          schema: nameSchema,
          code: 'ARTICLE_UNREADABLE',
          what: 'The name',
        })
      ).name,
    ),
});
