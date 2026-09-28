import { z } from 'zod';
import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { callOpenAiJson } from './openaiChat.ts';

export interface TranslateFieldsOptions<L extends string> {
  fields: Record<string, string>;
  targetLocales: readonly L[];
  languageName: Record<L, string>;
  businessDescription: string;
  subject: string;
  apiKey: string;
  model?: string;
}

const answerSchema = z.record(z.string(), z.unknown());

export function fieldsPrompt(
  language: string,
  businessDescription: string,
  subject: string,
): string {
  return (
    `You translate ${subject} from Russian into ${language} for ${businessDescription}. ` +
    'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write it — ' +
    'never a literal word-for-word translation. Keep markdown formatting intact. Keep brand names, part numbers, ' +
    'units and specification codes (such as 5W-30, ACEA C3, VW 504.00) exactly as written. The input is a flat ' +
    'JSON object whose keys are field names and whose values are the strings to translate. Respond with a JSON ' +
    'object having EXACTLY the same keys, with each value translated — never translate the keys themselves.'
  );
}

export async function translateFields<L extends string>(
  options: TranslateFieldsOptions<L>,
): Promise<Record<L, Record<string, string>>> {
  const {
    fields,
    targetLocales,
    languageName,
    businessDescription,
    subject,
    apiKey,
    model,
  } = options;
  const keys = Object.keys(fields);
  const entries = await Promise.all(
    targetLocales.map(async (locale) => {
      if (keys.length === 0) return [locale, {}] as const;
      const answer = answerSchema.parse(
        await callOpenAiJson({
          apiKey,
          model,
          systemPrompt: fieldsPrompt(
            languageName[locale],
            businessDescription,
            subject,
          ),
          userContent: JSON.stringify(fields),
        }),
      );
      assertSafeTranslation(fields, answer, `${subject}.${locale}`);
      const translated = z
        .record(z.string(), z.string())
        .parse(Object.fromEntries(keys.map((key) => [key, answer[key]])));
      return [locale, translated] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<L, Record<string, string>>;
}
