import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import type { ZodObject } from 'zod';
import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { getOrCreateTranslationsMap } from './getOrCreateTranslationsMap.ts';
import {
  blockIsEmpty,
  DEFAULT_CACHE_PATH,
  loadCache,
  pruneMissingFiles,
  saveCache,
  type CacheBlock,
  type CacheFile,
} from './leafCache.ts';
import { hashSource, type SectionData } from './hashSource.ts';
import { translateLeaves } from './translateLeaves.ts';
import { errorMessage } from './errorMessage.ts';

export interface Section {
  path: string;
  fields: readonly string[];
  schema: ZodObject;
  promptSubject: string;
}

export type SectionOutcome = 'translated' | 'backfilled' | 'skipped';

export interface SectionTranslatorOptions<L extends string> {
  targetLocales: readonly L[];
  languageName: Record<L, string>;
  businessDescription: string;
  model?: string;
  cachePath?: string;
}

export function buildSectionPrompt(
  promptSubject: string,
  languageName: string,
  businessDescription: string,
): string {
  return (
    `You translate ${promptSubject} from Russian into ${languageName} ` +
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
    'The input is a flat JSON object whose keys are field paths and whose values are the strings to ' +
    'translate. Respond with a JSON object having EXACTLY the same keys, with each value translated. ' +
    'A key like meta.metaTitle or steps[2].title tells you what the string is for — never translate ' +
    'the keys themselves.'
  );
}

export function createSectionTranslator<L extends string>({
  targetLocales,
  languageName,
  businessDescription,
  model,
  cachePath = DEFAULT_CACHE_PATH,
}: SectionTranslatorOptions<L>) {
  const names = new Map<string, string>(Object.entries<string>(languageName));

  async function processSection(
    section: Section,
    apiKey: string,
    cache: CacheFile,
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

    const committed = plain.translations as Record<string, unknown>;

    const translationsAreCurrent = storedHash === currentHash;

    const block: CacheBlock = cache[section.path] ?? {};
    const neverTranslated = blockIsEmpty(block);
    cache[section.path] = block;

    const used = new Set<string>();
    let requests = 0;
    let wrote = false;

    for (const locale of targetLocales) {
      const existing = committed[locale];
      const result = await translateLeaves({
        source,
        existing,
        block,
        translationsAreCurrent,
        neverTranslated,
        systemPrompt: buildSectionPrompt(
          section.promptSubject,
          names.get(locale) as string,
          businessDescription,
        ),
        apiKey,
        model,
      });
      requests += result.requests;
      for (const key of result.used) used.add(key);

      const parsed = section.schema.safeParse(result.value);
      if (!parsed.success) {
        throw new Error(
          `translate response for "${locale}" doesn't match the schema for ${section.promptSubject}: ${parsed.error.message}`,
        );
      }
      assertSafeTranslation(source, parsed.data, '');

      if (JSON.stringify(existing) !== JSON.stringify(parsed.data)) {
        translationsNode.set(locale, parsed.data);
        wrote = true;
      }
    }

    cache[section.path] = Object.fromEntries(
      Object.entries(block).filter(([key]) => used.has(key)),
    );

    if (storedHash !== currentHash) {
      doc.set('translatedFrom', currentHash);
      wrote = true;
    }
    if (wrote) writeFileSync(section.path, doc.toString({ lineWidth: 0 }));

    if (requests > 0) return 'translated';
    return wrote ? 'backfilled' : 'skipped';
  }

  async function run(sections: readonly Section[]): Promise<number> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Missing env var: OPENAI_API_KEY');
      return 1;
    }

    let cache: CacheFile;
    try {
      cache = loadCache(cachePath);
    } catch (err) {
      console.error(`✗ ${cachePath}: ${errorMessage(err)}`);
      return 1;
    }
    let failed = 0;
    for (const section of sections) {
      try {
        const result = await processSection(section, apiKey, cache);
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
      saveCache(cachePath, cache);
    }

    if (failed === 0) {
      pruneMissingFiles(cache);
      saveCache(cachePath, cache);
    }

    return failed > 0 ? 1 : 0;
  }

  return { processSection, run };
}
