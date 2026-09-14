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

// gpt-4o-mini caps a completion at 16k tokens, and approved-rs's services.yaml
// outgrew that in one request: the tail key came back missing, or the socket
// timed out mid-generation. Top-level keys are translated in batches small
// enough to stay well under the cap; the merged result is still validated
// against the section's full schema, so a dropped key still fails loudly.
const MAX_REQUEST_CHARS = 8_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function chunkByKey(
  data: SectionData,
  maxChars = MAX_REQUEST_CHARS,
): SectionData[] {
  const chunks: SectionData[] = [];
  let current: SectionData = {};
  let size = 0;

  const flush = () => {
    if (size > 0) chunks.push(current);
    current = {};
    size = 0;
  };

  for (const [key, value] of Object.entries(data)) {
    const cost = JSON.stringify({ [key]: value }).length;
    // A single key can outgrow the budget on its own, and asking for the whole
    // thing back is how the model starts dropping nested arrays. Split it by
    // its own children and let mergeChunks put the halves back together.
    if (cost > maxChars && isPlainObject(value)) {
      flush();
      for (const part of chunkByKey(value as SectionData, maxChars)) {
        chunks.push({ [key]: part });
      }
      continue;
    }
    if (size > 0 && size + cost > maxChars) flush();
    current[key] = value;
    size += cost;
  }
  flush();
  return chunks;
}

export function mergeChunks(into: SectionData, from: SectionData): SectionData {
  for (const [key, value] of Object.entries(from)) {
    const existing = into[key];
    into[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? mergeChunks(existing as SectionData, value as SectionData)
        : value;
  }
  return into;
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
    const systemPrompt =
      `You translate ${section.promptSubject} from Russian into ${names.get(targetLocale)} ` +
      `for ${businessDescription}. ` +
      'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
      'it — never a literal word-for-word translation. Keep any markdown formatting intact. If a string ' +
      'contains a placeholder token like {siteName} in curly braces, copy it into the translation exactly ' +
      'as written, character for character — never translate, remove, or move it. Copy personal names ' +
      'exactly as written too, keeping their original script — never transliterate or localise them. ' +
      'Search-engine snippets have a hard budget: metaTitle and title at most 60 characters, ' +
      'metaDescription and description at most 160, counted on what you output. German and Spanish ' +
      'run longer than the Russian, so drop a detail rather than going over — but never drop a ' +
      'placeholder token to save room. ' +
      'Use the trade word a mechanic or a driver would use, not the everyday one: ' +
      'a car battery is akumulator in Serbian, Autobatterie in German, batería de coche in ' +
      'Spanish — never baterija, Batterie or pila on their own. The same holds for the rest ' +
      'of the workshop vocabulary: servicing, timing belt, suspension, customs clearance. ' +
      'Respond with a JSON ' +
      'object that has EXACTLY the same nested key structure as the input — same keys, same nesting, same ' +
      'array lengths — with only the string values translated.';

    const merged: SectionData = {};
    for (const chunk of chunkByKey(data)) {
      const raw = await callOpenAiJson({
        apiKey,
        model,
        systemPrompt,
        userContent: JSON.stringify(chunk),
      });
      mergeChunks(merged, raw as SectionData);
    }

    const parsed = section.schema.safeParse(merged);
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

  function recordHashes(sections: readonly Section[]): number {
    let rewritten = 0;
    for (const section of sections) {
      const doc = parseDocument(readFileSync(section.path, 'utf-8'));
      const plain = doc.toJS() as SectionData;
      const rawSource: SectionData = {};
      for (const field of section.fields) {
        if (plain[field] !== undefined) rawSource[field] = plain[field];
      }
      const next = hashSource(section.schema.parse(rawSource) as SectionData);
      if (doc.get('translatedFrom') === next) continue;
      doc.set('translatedFrom', next);
      writeFileSync(section.path, doc.toString({ lineWidth: 0 }));
      rewritten += 1;
    }
    return rewritten;
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

  return { translateSection, processSection, recordHashes, run };
}
