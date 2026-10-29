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
import partsGlossary from './parts-glossary.json';

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

const glossarySchema = z.array(
  z.object({ sr: z.string().min(1), ru: z.string().min(1) }),
);

const glossaryLines = glossarySchema
  .parse(partsGlossary)
  .map(({ sr, ru }) => `- ${sr}: ${ru}`)
  .join('\n');

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
- The part type in Russian as a Russian parts shop names it, with a lowercase rest, then the brand and the number exactly as given, e.g. «Масляный фильтр MANN-FILTER HU 816 x», «Втулка стабилизатора febi 41997».
- Translate the meaning, never the sound: a Serbian word is never written in Cyrillic letters as if it were Russian («nosač» is not «носач», «rame» is not «рама», «kugla» is not «кугла»). Use the glossary below for Serbian part words. No Serbian or English word stays in the name, in any script.
- Keep a short qualifier the input states when it tells parts of one type apart (e.g. «передний», «для АКПП», «с прокладкой», «с монтажным комплектом»).
- No marketing words, no vehicle names, no prices.

Serbian to Russian part glossary (Serbian words: Russian term):
${glossaryLines}

"category_id" is the id of the one category below the part belongs to. Never invent an id. When the input's "category_id" is not null, return it unchanged.
- Judge by what the part is, read from its name, description and specs, and by each category's name and the description in brackets after it.
- Every filter (oil, air, cabin, fuel, hydraulic, transmission or particle filter) and every other part replaced at scheduled service (spark and glow plugs, wiper blades, service fluids) belongs to the category for scheduled maintenance and consumables.
- Every starter battery, of any technology and for any vehicle, belongs to the battery category.
- A control arm or wishbone, a ball joint, a tie rod or its end, a stabiliser link or bushing, a bump stop, a spring, a shock absorber, a strut mount and their bushings and bearings belong to the suspension or steering category, never to a body, frame or engine category.
- Brake discs, drums, pads, shoes, calipers, cylinders, hoses, cables and wear sensors belong to the brake category.
- Return null only when no category covers the kind of part at all.

"attributes" maps the input to the fields listed under the chosen category, {} when it has none:
- Use only that category's field keys, each at most once. Read values from the specs, the name and the description; leave a field out when none of them gives its value.
- "number": a non-negative JSON number in the field's unit, converted when the input uses another unit.
- "boolean": true or false.
- "text": a short string.
- "single-select": the key of one listed option. "multi-select": a non-empty array of distinct listed option keys. Never write a key that is not listed; leave the field out when no listed option matches.
- An option counts when the input names the same thing in other words, such as a battery's SLI, wet or flooded technology for the plain standard option.
- A starter battery whose input names no AGM, EFB or gel technology is a standard flooded battery: use the standard option.
- Never guess any other value the input does not state.

"description" is the Russian description for the part's page, or null when the input has neither a description nor specs:
- Call the part what "name" and the category call it. Never rename it into another part type, and never translate the supplier's name word by word.
- Two or three short paragraphs of plain Russian text separated by a blank line, no markdown, no HTML, no lists.
- The first sentence names the part type with its brand and number, so that no two parts share a description. Then the part's own specs from the input (sizes, capacity, current, fitting position, material), then what the part does.
- Use only facts the input states. Rewrite in your own words, never copy the supplier's sentences.
- Leave out every claim of quality, service life, comfort, health, reliability or conformity the supplier makes, such as «Strogi standardi kvaliteta», «Dug vek trajanja», «Optimalno prilagođavanje za glatku popravku», «Ispunjavanje zahteva proizvođača vozila», a triple service life, preventing allergies or first-class quality.
- No prices, stock, delivery, the supplier's name, superlatives or guarantees.

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
