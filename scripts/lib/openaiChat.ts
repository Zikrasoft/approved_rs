import OpenAI from 'openai';
import type { TranslatableLocale } from '../../src/i18n/config.ts';

// Shared across every translate-*.ts script — was hand-duplicated (same
// map, same fetch/headers/error-handling) between translate-cases.ts and
// translate-i18n.ts before this existed. Each script still owns its
// own prompt text and response validation (a case is {title,body}; the
// dictionary is whatever dictionaryContentSchema describes) — only the
// request/response envelope to OpenAI is shared here.
export const TARGET_LANGUAGE_NAME: Record<TranslatableLocale, string> = {
  en: 'English',
  sr: 'Serbian (Latin script)',
  es: 'Spanish',
  de: 'German',
};

// The official SDK (not a hand-rolled fetch) retries transient failures
// (429/5xx/timeouts) with backoff by default — a build script that only
// runs a handful of times per push benefits from that for free.
export async function callOpenAiJson(params: {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
}): Promise<unknown> {
  const { apiKey, systemPrompt, userContent } = params;
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('translate response missing content');

  return JSON.parse(content) as unknown;
}
