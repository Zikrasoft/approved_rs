import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import type { ZodObject } from 'zod';
import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { getOrCreateTranslationsMap } from './getOrCreateTranslationsMap.ts';
import { hasRealTranslation } from './hasRealTranslation.ts';
import { callOpenAiJson } from './openaiChat.ts';
import { sha256Hex } from './sha256Hex.ts';
import { decideAction } from './translateDecision.ts';
import { errorMessage } from './errorMessage.ts';

export interface Section {
  path: string;
  fields: readonly string[];
  schema: ZodObject;
  promptSubject: string;
}

export type SectionData = Record<string, unknown>;

export type SectionOutcome = 'translated' | 'backfilled' | 'skipped';

export interface SectionTranslatorOptions<L extends string> {
  targetLocales: readonly L[];
  languageName: Record<L, string>;
  businessDescription: string;
  model?: string;
}

export function hashSource(data: SectionData): string {
  return sha256Hex(JSON.stringify(data));
}

export function createSectionTranslator<L extends string>({
  targetLocales,
  languageName,
  businessDescription,
  model,
}: SectionTranslatorOptions<L>) {
  const names = new Map<string, string>(Object.entries<string>(languageName));

  async function translateSection(
    data: SectionData,
    targetLocale: L,
    apiKey: string,
    section: Pick<Section, 'schema' | 'promptSubject'>,
  ): Promise<SectionData> {
    const raw = await callOpenAiJson({
      apiKey,
      model,
      systemPrompt:
        `You translate ${section.promptSubject} from Russian into ${names.get(targetLocale)} ` +
        `for ${businessDescription}. ` +
        'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
        'it — never a literal word-for-word translation. Keep any markdown formatting intact. If a string ' +
        'contains a placeholder token like {siteName} in curly braces, copy it into the translation exactly ' +
        'as written, character for character — never translate, remove, or move it. Respond with a JSON ' +
        'object that has EXACTLY the same nested key structure as the input — same keys, same nesting, same ' +
        'array lengths — with only the string values translated.',
      userContent: JSON.stringify(data),
    });

    const parsed = section.schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `translate response for "${targetLocale}" doesn't match the schema for ${section.promptSubject}: ${parsed.error.message}`,
      );
    }
    assertSafeTranslation(data, parsed.data, '');
    return parsed.data as SectionData;
  }

  async function processSection(
    section: Section,
    apiKey: string,
  ): Promise<SectionOutcome> {
    const doc = parseDocument(readFileSync(section.path, 'utf-8'));
    const translationsNode = getOrCreateTranslationsMap(doc, section.path);

    const plain = doc.toJS() as SectionData;
    const rawSource: SectionData = {};
    for (const field of section.fields) {
      if (plain[field] !== undefined) rawSource[field] = plain[field];
    }
    const source = section.schema.parse(rawSource) as SectionData;
    const currentHash = hashSource(source);
    const storedHash = doc.get('translatedFrom') as string | undefined;

    const action = decideAction({
      targetLocales,
      storedHash,
      currentHash,
      hasReal: (locale) =>
        hasRealTranslation(translationsNode, locale, section.fields),
    });

    if (action.kind === 'skip') return 'skipped';

    if (action.kind === 'backfill') {
      doc.set('translatedFrom', currentHash);
      writeFileSync(section.path, doc.toString({ lineWidth: 0 }));
      return 'backfilled';
    }

    for (const locale of action.locales) {
      const translation = await translateSection(
        source,
        locale,
        apiKey,
        section,
      );
      translationsNode.set(locale, translation);
    }
    doc.set('translatedFrom', currentHash);

    writeFileSync(section.path, doc.toString({ lineWidth: 0 }));
    return 'translated';
  }

  async function run(sections: readonly Section[]): Promise<number> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Missing env var: OPENAI_API_KEY');
      return 1;
    }

    let failed = 0;
    for (const section of sections) {
      try {
        const result = await processSection(section, apiKey);
        if (result === 'translated') {
          console.log(`✓ ${section.path} (translated)`);
        } else if (result === 'backfilled') {
          console.log(
            `~ ${section.path} (recorded hash, no translation needed)`,
          );
        } else {
          console.log(`- ${section.path} (up to date)`);
        }
      } catch (err) {
        failed++;
        console.error(`✗ ${section.path}: ${errorMessage(err)}`);
      }
    }
    return failed > 0 ? 1 : 0;
  }

  return { translateSection, processSection, run };
}
