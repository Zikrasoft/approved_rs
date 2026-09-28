import OpenAI from 'openai';

export const DEFAULT_TRANSLATE_MODEL = 'gpt-4o-mini';

export const OPENAI_TIMEOUT_MS = 60_000;
export const OPENAI_MAX_RETRIES = 1;

export async function callOpenAiJson(params: {
  apiKey: string;
  systemPrompt: string;
  userContent: string;
  model?: string;
}): Promise<unknown> {
  const {
    apiKey,
    systemPrompt,
    userContent,
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
  if (!content) throw new Error('translate response missing content');

  return JSON.parse(content) as unknown;
}
