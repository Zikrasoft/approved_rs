import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export const DEFAULT_PAYOUT_MODEL = 'gpt-4o-mini';
export const MAX_PAYOUT_AMOUNT = 1_000_000;

export interface PayoutHints {
  amount: number;
  note: string;
  clientName: string | null;
  clientPhone: string | null;
  brand: string | null;
}

export type PayoutParser = (text: string) => Promise<PayoutHints | null>;

export interface PayoutParserOptions {
  apiKey: string;
  brands: Readonly<Record<string, string>>;
  model?: string;
  fetch?: typeof fetch;
}

const WORDS_OR_DIGITS = /[\p{L}\d]/u;

function brandHint(brands: Readonly<Record<string, string>>): string[] {
  const entries = Object.entries(brands);
  if (entries.length === 0) return [];
  return [
    '- brand: the business the message is about, exactly one of the names below, only when the message names it or its line of work; null otherwise.',
    ...entries.map(([name, about]) => `- ${name}: ${about}`),
  ];
}

function systemPrompt(brands: Readonly<Record<string, string>>): string {
  return [
    'You read one message the owner of a car business posts in a work chat, in Russian or Serbian, typed or transcribed from voice.',
    'Decide whether it records a payout: money the owner states he owes his partner for a client, in euros.',
    'Numbers that are times, dates, model years, mileage, phone numbers or prices quoted to a client are not a payout on their own.',
    'Fill the fields:',
    '- isPayout: true only when the message states such an amount.',
    '- amount: that amount in euros as a number, words turned into digits; null when there is none.',
    '- note: what the money was for, short, in the language of the message, without the amount, the name or the phone; empty when nothing is said.',
    "- clientName: the client's name in the nominative case, as written in a CRM; null when none is named.",
    "- clientPhone: the client's phone number as written; null when none is given.",
    ...brandHint(brands),
  ].join('\n');
}

const brandNamesSchema = z.tuple([z.string()], z.string());

function brandSchema(brands: Readonly<Record<string, string>>) {
  const names = brandNamesSchema.safeParse(Object.keys(brands));
  return names.success ? z.enum(names.data).nullable() : z.null();
}

function replySchema(brands: Readonly<Record<string, string>>) {
  return z.object({
    isPayout: z.boolean(),
    amount: z.number().nullable(),
    note: z.string(),
    clientName: z.string().nullable(),
    clientPhone: z.string().nullable(),
    brand: brandSchema(brands),
  });
}

const blankToNull = (value: string | null) => value?.trim() || null;

export function createPayoutParser({
  apiKey,
  brands,
  model = DEFAULT_PAYOUT_MODEL,
  fetch,
}: PayoutParserOptions): PayoutParser {
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1, fetch });
  const responseFormat = zodResponseFormat(replySchema(brands), 'payout');
  const instructions = systemPrompt(brands);

  return async (text) => {
    if (!WORDS_OR_DIGITS.test(text)) return null;
    const completion = await client.chat.completions.parse({
      model,
      response_format: responseFormat,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: text },
      ],
    });
    const reply = completion.choices[0]?.message.parsed;
    if (
      !reply?.isPayout ||
      reply.amount == null ||
      reply.amount <= 0 ||
      reply.amount > MAX_PAYOUT_AMOUNT
    ) {
      return null;
    }
    return {
      amount: reply.amount,
      note: reply.note.trim(),
      clientName: blankToNull(reply.clientName),
      clientPhone: blankToNull(reply.clientPhone),
      brand: reply.brand,
    };
  };
}
