import { MedusaError } from '@medusajs/framework/utils';
import { CARLAB } from '@podbor/brands';
import OpenAI from 'openai';
import { z } from 'zod';

import { adminError } from '../admin-errors';
import {
  quoteReadingSchema,
  type CategoryChoice,
  type ShopAi,
} from './contract';

const QUOTE_MODEL = 'gpt-4o';
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 1;

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
${categories.map(({ id, name }) => `${id}: ${name}`).join('\n') || '(none)'}`;

const unreadable = (detail: string) =>
  adminError(
    MedusaError.Types.INVALID_DATA,
    'QUOTE_UNREADABLE',
    `The Workshop quote could not be read: ${detail}`,
  );

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    throw unreadable('the answer is not JSON');
  }
};

export const openAiShopAi = (apiKey: string | undefined): ShopAi => ({
  readQuote: async (pdf, categories) => {
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
      model: QUOTE_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: quotePrompt(categories) },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'ponuda.pdf',
                file_data: `data:application/pdf;base64,${pdf.toString('base64')}`,
              },
            },
          ],
        },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw unreadable('the answer is empty');
    const reading = quoteReadingSchema.safeParse(parseJson(content));
    if (!reading.success) throw unreadable(z.prettifyError(reading.error));
    return reading.data;
  },
});
