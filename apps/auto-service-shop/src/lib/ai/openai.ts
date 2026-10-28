import { MedusaError } from '@medusajs/framework/utils';
import { CARLAB } from '@podbor/brands';
import OpenAI from 'openai';
import { z } from 'zod';

import { adminError, type AdminErrorCode } from '../admin-errors';
import {
  articleAnswerSchema,
  type CategoryChoice,
  quoteReadingSchema,
  type ShopAi,
} from './contract';

const QUOTE_MODEL = 'gpt-4o';
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 1;

const categoryLine = ({ id, name, text }: CategoryChoice) => {
  const about = text?.replace(/\s+/gu, ' ').trim();
  return about ? `${id}: ${name} (${about})` : `${id}: ${name}`;
};

const categoryList = (categories: CategoryChoice[]) =>
  categories.map(categoryLine).join('\n') || '(none)';

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

const fieldedCategoryList = (categories: CategoryChoice[]) =>
  categories
    .map((category) =>
      category.fields?.length
        ? `${categoryLine(category)}\n  fields: ${JSON.stringify(category.fields)}`
        : categoryLine(category),
    )
    .join('\n') || '(none)';

const articlePrompt = (
  categories: CategoryChoice[],
) => `You put a car part from a supplier's catalogue into the online parts catalogue of ${CARLAB.name}, a car service in Belgrade, Serbia. The user message is the part as JSON: the supplier's name for it (often in Serbian or English), its brand, number, the supplier's description, its raw specs (name to value) and "category_id", the category it is already filed under, or null.

Answer with one JSON object and nothing else:
{
  "name": string,
  "category_id": string or null,
  "attributes": { field key: value },
  "description": string or null
}

"name" is the Russian name of the part:
- The part type in Russian as a parts shop names it, with a lowercase rest, then the brand and the number exactly as given, e.g. «Масляный фильтр MANN-FILTER HU 816 x».
- Add a short qualifier only when the input states it and it tells parts of one type apart (e.g. «передний», «с прокладкой»).
- No marketing words, no vehicle names, no prices.

"category_id" is the id of the one category below the part belongs to, or null when none fits exactly. Never invent an id. When the input's "category_id" is not null, return it unchanged.
- Judge by what the part is, read from its name, description and specs, and by each category's name and the description in brackets after it.
- A control arm or wishbone (Serbian «rame», «ramena», «poprečno rame», «vodjica»), a ball joint («kugla», «kuglasti zglob»), a tie rod or its end («spona»), a stabiliser link, a bump stop («odbojnik», «odbojna guma»), a spring, a shock absorber and their bushings, mounts and bearings belong to the suspension or steering category, never to a body, frame or engine category.
- Prefer null over a category that only shares a word with the part.

"attributes" maps the raw specs to the fields listed under the chosen category, {} when it has none or no spec gives a value:
- Use only that category's field keys, each at most once. Leave a field out when no spec gives its value.
- "number": a non-negative JSON number in the field's unit, converted when the spec uses another unit.
- "boolean": true or false.
- "text": a short string.
- "single-select": the key of one option. "multi-select": a non-empty array of distinct option keys.
- An option counts when the spec names the same thing in other words, such as a battery's SLI, wet or flooded technology for the plain standard option.
- Never guess a value no spec states.

"description" is the Russian description for the part's page, or null when the input has neither a description nor specs:
- Call the part what "name" and the category call it. Never rename it into another part type, and never translate the supplier's name word by word.
- Two to four short paragraphs of plain Russian text separated by a blank line, no markdown, no HTML, no lists.
- Use only facts the input states: what the part is, what it does, its key specs. Rewrite in your own words, never copy the supplier's sentences.
- No prices, stock, delivery, the supplier's name, marketing superlatives or guarantees.

In "name" and "description": never use the Cyrillic letter yo (U+0451), write «е» instead. Never use the em dash (U+2014). Every Russian word in Cyrillic letters only; brand names and numbers stay as given.

Categories (id: name (description), then the category's fields):
${fieldedCategoryList(categories)}`;

const unreadable = (code: AdminErrorCode, what: string, detail: string) =>
  adminError(
    MedusaError.Types.INVALID_DATA,
    code,
    `${what} could not be read: ${detail}`,
  );

type Ask<T> = {
  apiKey: string | undefined;
  model: string;
  system: string;
  user: OpenAI.Chat.ChatCompletionUserMessageParam['content'];
  schema: z.ZodType<T>;
  code: AdminErrorCode;
  what: string;
  retries?: number;
  temperature?: number;
};

const ask = async <T>({ retries = 0, ...question }: Ask<T>): Promise<T> => {
  if (!question.apiKey) {
    throw adminError(
      MedusaError.Types.NOT_ALLOWED,
      'AI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not set',
    );
  }
  try {
    return await askOnce({ ...question, apiKey: question.apiKey });
  } catch (error) {
    const unreadableAnswer =
      MedusaError.isMedusaError(error) && error.code === question.code;
    if (!unreadableAnswer || retries < 1) throw error;
    return ask({ ...question, retries: retries - 1 });
  }
};

const askOnce = async <T>({
  apiKey,
  model,
  system,
  user,
  schema,
  code,
  what,
  temperature,
}: Omit<Ask<T>, 'retries'> & { apiKey: string }): Promise<T> => {
  const client = new OpenAI({
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  const response = await client.chat.completions.create({
    model,
    temperature,
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

const inHouseStyle = (text: string) =>
  text.replaceAll('ё', 'е').replaceAll('Ё', 'Е').replaceAll('—', '-');

export const openAiShopAi = (
  apiKey: string | undefined,
  articleModel: string,
): ShopAi => ({
  readQuote: (pdf, categories) =>
    ask({
      apiKey,
      model: QUOTE_MODEL,
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
  articleQuestion: (article, categories) => ({
    model: articleModel,
    system: articlePrompt(categories),
    user: JSON.stringify(article),
  }),
  answerArticle: async (question) => {
    const answer = await ask({
      apiKey,
      ...question,
      schema: articleAnswerSchema,
      code: 'ARTICLE_UNREADABLE',
      what: 'The article',
      retries: 1,
      temperature: 0,
    });
    return {
      ...answer,
      name: inHouseStyle(answer.name),
      description: answer.description && inHouseStyle(answer.description),
    };
  },
});
