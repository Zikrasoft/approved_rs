import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { callOpenAiJson } from './openaiChat.ts';

const CYRILLIC = /\p{Script=Cyrillic}/u;

export interface TranslateFieldsOptions<L extends string> {
  fields: Record<string, string>;
  targetLocales: readonly L[];
  languageName: Record<L, string>;
  businessDescription: string;
  subject: string;
  apiKey: string;
  model?: string;
}

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
  const russian = Object.fromEntries(
    Object.entries(fields).filter(([, text]) => CYRILLIC.test(text)),
  );
  const entries = await Promise.all(
    targetLocales.map(async (locale) => {
      if (Object.keys(russian).length === 0)
        return [locale, { ...fields }] as const;
      const chunk = `${subject}.${locale}`;
      const answer = await callOpenAiJson({
        apiKey,
        model,
        systemPrompt: fieldsPrompt(
          languageName[locale],
          businessDescription,
          subject,
        ),
        userContent: JSON.stringify(russian),
        chunk,
      });
      assertSafeTranslation(russian, answer, chunk);
      return [
        locale,
        Object.fromEntries(
          keys.map((key) => [key, key in russian ? answer[key] : fields[key]]),
        ),
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<L, Record<string, string>>;
}
