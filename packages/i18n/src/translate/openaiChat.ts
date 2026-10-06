import OpenAI from 'openai';
import { z } from 'zod';

export const DEFAULT_TRANSLATE_MODEL = 'gpt-4o-mini';

export const OPENAI_TIMEOUT_MS = 60_000;
export const OPENAI_MAX_RETRIES = 1;

const translationSchema = z.record(z.string(), z.string());

export class TranslateResponseError extends Error {
  readonly chunk: string;

  constructor(chunk: string, detail: string) {
    super(`translate response for "${chunk}" is malformed: ${detail}`);
    this.name = 'TranslateResponseError';
    this.chunk = chunk;
  }
}

export async function callOpenAiJson(params: {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
  chunk: string;
  model?: string;
}): Promise<Record<string, string>> {
  const {
    apiKey,
    systemPrompt,
    userContent,
    chunk,
    model = DEFAULT_TRANSLATE_MODEL,
  } = params;
  const client = new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new TranslateResponseError(chunk, 'missing content');

  const parsed = translationSchema.safeParse(JSON.parse(content));
  if (!parsed.success)
    throw new TranslateResponseError(chunk, z.prettifyError(parsed.error));
  return parsed.data;
}
