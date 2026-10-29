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

const numberedCategoryList = (categories: CategoryChoice[]) =>
  categories
    .map((category, at) => {
      const line = categoryLine({ ...category, id: String(at + 1) });
      return category.fields?.length
        ? `${line}\n  fields: ${JSON.stringify(category.fields)}`
        : line;
    })
    .join('\n') || '(none)';

const numberedAnswerSchema = articleAnswerSchema
  .omit({ category_id: true })
  .extend({ category: z.coerce.number().int().positive().nullable() });

const categoryNumber = (categories: CategoryChoice[], id: string | null) => {
  const at = categories.findIndex((category) => category.id === id);
  return at < 0 ? null : at + 1;
};

const glossarySchema = z.array(
  z.object({ sr: z.string().min(1), ru: z.string().min(1) }),
);

const glossary = glossarySchema
  .parse(partsGlossary)
  .map(({ sr, ru }) => ({ terms: sr.split(','), line: `${sr}: ${ru}` }));

const glossaryLines = glossary.map(({ line }) => `- ${line}`).join('\n');

const wordsOf = (text: string) => text.toLowerCase().match(/\p{L}+/gu) ?? [];

const stemOf = (word: string) => word.slice(0, Math.max(4, word.length - 2));

const mentions = (words: string[], term: string) =>
  wordsOf(term).every((termWord) =>
    words.some((word) => word.startsWith(stemOf(termWord))),
  );

const glossaryFor = (name: string) => {
  const words = wordsOf(name);
  return glossary
    .filter(({ terms }) => terms.some((term) => mentions(words, term)))
    .map(({ line }) => line);
};

const articlePrompt = (
  categories: CategoryChoice[],
) => `You put a car part from a supplier's catalogue into the online parts catalogue of ${CARLAB.name}, a car service in Belgrade, Serbia. The user message is the part as JSON: the supplier's name for it (often in Serbian or English), its brand, number, the supplier's description, its raw specs (name to value), "fits", the vehicles it fits most often (make and model, possibly empty), "glossary", the glossary lines for the Serbian words in its name, and "category", the number of the category it is already filed under, or null.

Answer with one JSON object and nothing else:
{
  "name": string,
  "category": category number or null,
  "attributes": { field key: value },
  "description": string or null
}

"name" is the Russian name of the part:
- The part type in Russian as a Russian parts shop names it, with a lowercase rest, then the brand and the number exactly as given, e.g. «Масляный фильтр MANN-FILTER HU 816 x», «Втулка стабилизатора febi 41997».
- The brand and the number are always in the name, even when the input name lacks them.
- Translate the meaning, never the sound: a Serbian word is never written in Cyrillic letters as if it were Russian («nosač» is not «носач», «rame» is not «рама», «kugla» is not «кугла»). The input's "glossary" lines and the glossary below give the Russian term for Serbian part words: use that term, not your own translation. No Serbian or English word stays in the name, in any script.
- Keep a short qualifier the input states when it tells parts of one type apart (e.g. «передний», «для АКПП», «с прокладкой», «с монтажным комплектом»).
- No marketing words, no vehicle names, no prices.

Serbian to Russian part glossary (Serbian words: Russian term):
${glossaryLines}

"category" is the number of the one category below the part belongs to, exactly as listed. When the input's "category" is not null, return it unchanged.
- Judge by what the part is, read from its name, description and specs, and by each category's name and the description in brackets after it.
- Every filter (oil, air, cabin, fuel, hydraulic, transmission or particle filter) and every other part replaced at scheduled service (spark and glow plugs, wiper blades, service fluids) belongs to the category for scheduled maintenance and consumables.
- Every starter battery, of any technology and for any vehicle, belongs to the battery category.
- A control arm or wishbone, a ball joint, a tie rod or its end, a stabiliser link or bushing, a bump stop, a spring, a shock absorber, a strut mount and their bushings and bearings belong to the suspension or steering category, never to a body, frame or engine category.
- Brake discs, drums, pads, shoes, calipers, cylinders, hoses, cables and wear sensors belong to the brake category.
- Timing belts and their kits, drive and V-ribbed belts, belt tensioners and pulleys, gaskets and engine mounts belong to the engine category.
- Return null only when no category covers the kind of part at all.

"attributes" maps the input to the fields listed under the chosen category, {} when it has none:
- Use only that category's field keys, each at most once. Read values from the specs, the name and the description; leave a field out when none of them gives its value.
- "number": a non-negative JSON number in the field's unit, converted when the input uses another unit.
- "boolean": true or false.
- "text": a short string.
- "single-select": the key of one listed option. "multi-select": a non-empty array of distinct listed option keys. Never write a key that is not listed.
- An option counts only when the input names it or the same thing in other words, such as a battery's SLI, wet or flooded technology for the plain standard option. Never pick the nearest option: a case size, polarity or similar code counts only when the input gives that very code; otherwise leave the field out.
- A lead-acid starter battery whose input names no AGM, EFB or gel technology is a standard flooded battery: use the standard option. A lithium battery has none of these technologies.
- A boolean field for Start-Stop suitability is true for an AGM or EFB battery or one the input calls Start-Stop, and false for a standard flooded battery.
- Never guess any other value the input does not state.

"description" is the Russian description for the part's page, or null when the input has neither a description nor specs:
- Call the part what "name" and the category call it. Never rename it into another part type.
- Rewrite the supplier's facts in new words: new sentences, another order, synonyms. Never translate or copy its sentences, so no text is a copy of the source and no two parts share a description.
- Two or three short paragraphs of plain Russian text separated by a blank line, no markdown, no HTML, no lists, no emoji.
- The first sentence names the part type the way people search for it, with its brand and number (e.g. «масляный фильтр», «фильтр салона», «аккумулятор 12 В 74 Ач»). Then the part's own specs from the input (sizes, capacity, current, voltage, fitting position, material). When "fits" is not empty, say which makes and models it fits, naming a few of them («подходит, в том числе, для ...»). Then what the part does, in one or two plain sentences.
- Each search phrase at most twice; no keyword lists, no closing sentence that repeats the paragraph above.
- Use only facts the input states. Never invent a spec, a vehicle or a benefit.
- Write like a mechanic explaining the part to a customer: plain and specific, no sales register.
- Leave out every claim of quality, service life, comfort, health, reliability or conformity the supplier makes, such as «Strogi standardi kvaliteta», «Dug vek trajanja», «Optimalno prilagođavanje za glatku popravku», «Ispunjavanje zahteva proizvođača vozila», a triple service life, preventing allergies or first-class quality, and words like «надежный», «высококачественный», «оптимальный», «эффективно», «высокая производительность».
- No prices, stock, delivery, the supplier's name, superlatives or guarantees.

In "name" and "description": never use the Cyrillic letter yo (U+0451), write «е» instead. Never use the em dash (U+2014). Every Russian word in Cyrillic letters only; brand names and numbers stay as given.

Categories (number: name (description), then the category's fields):
${numberedCategoryList(categories)}`;

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

const capitalized = (text: string) =>
  text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);

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
  articleQuestion: ({ category_id, ...article }, categories) => ({
    model: articleModel,
    system: articlePrompt(categories),
    user: JSON.stringify({
      ...article,
      glossary: glossaryFor(article.name),
      category: categoryNumber(categories, category_id),
    }),
    categoryIds: categories.map(({ id }) => id),
  }),
  answerArticle: async ({ categoryIds, ...question }) => {
    const { category, ...answer } = await ask({
      apiKey,
      ...question,
      schema: numberedAnswerSchema,
      code: 'ARTICLE_UNREADABLE',
      what: 'The article',
      retries: 1,
      temperature: 0,
    });
    return {
      ...answer,
      category_id: category ? (categoryIds[category - 1] ?? null) : null,
      name: capitalized(inHouseStyle(answer.name)),
      description: answer.description && inHouseStyle(answer.description),
    };
  },
});
