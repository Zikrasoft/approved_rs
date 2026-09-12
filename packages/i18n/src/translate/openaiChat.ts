import OpenAI from 'openai';

export const DEFAULT_TRANSLATE_MODEL = 'gpt-4o-mini';

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
  const client = new OpenAI({ apiKey });
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
