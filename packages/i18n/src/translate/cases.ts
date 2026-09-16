import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
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
import { sha256Hex } from './sha256Hex.ts';
import { translateLeaves } from './translateLeaves.ts';
import { errorMessage } from './errorMessage.ts';

export interface CaseTranslation {
  title: string;
  body: string;
  [field: string]: string;
}

export type CaseOutcome = 'translated' | 'backfilled' | 'skipped';

const FIELD_GUIDANCE: Record<string, string> = {
  car:
    'The "car" field holds a vehicle make and model: reproduce it verbatim, ' +
    'and translate it only when the source is a descriptive phrase rather than a model name.',
};

export interface CaseTranslatorOptions<L extends string> {
  targetLocales: readonly L[];
  languageName: Record<L, string>;
  businessDescription: string;
  subject: string;
  model?: string;
  extraFields?: readonly string[];
  cachePath?: string;
}

export function splitFrontmatter(raw: string): {
  frontmatter: string;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('no frontmatter found');
  return { frontmatter: match[1], body: match[2] };
}

export function hashSource(
  source: CaseTranslation,
  extraFields: readonly string[] = [],
): string {
  const extras = extraFields.map((field) => `\n${field}: ${source[field]}`);
  return sha256Hex(`${source.title}\n${source.body}${extras.join('')}`);
}

export function createCaseTranslator<L extends string>({
  targetLocales,
  languageName,
  businessDescription,
  subject,
  model,
  extraFields = [],
  cachePath = DEFAULT_CACHE_PATH,
}: CaseTranslatorOptions<L>) {
  const names = new Map<string, string>(Object.entries<string>(languageName));

  function buildCasePrompt(targetLocale: L, extras: readonly string[]): string {
    const guidance = extras
      .map((field) => FIELD_GUIDANCE[field])
      .filter(Boolean)
      .map((sentence) => ` ${sentence}`)
      .join('');
    return (
      `You translate ${subject} from Russian into ${names.get(targetLocale)} ` +
      `for ${businessDescription}. ` +
      'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
      'this case study — never a literal word-for-word translation. Keep markdown formatting (headings, ' +
      'bold, lists) intact. Keep car makes/models, prices, and place names as they would normally appear ' +
      `in the target language.${guidance} The input is a flat JSON object whose keys are field names ` +
      'and whose values are the strings to translate. Respond with a JSON object having EXACTLY the ' +
      'same keys, with each value translated — never translate the keys themselves.'
    );
  }

  async function processFile(
    path: string,
    apiKey: string,
    cache: CacheFile,
  ): Promise<CaseOutcome> {
    const raw = readFileSync(path, 'utf-8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const doc = parseDocument(frontmatter);
    const translationsNode = getOrCreateTranslationsMap(doc, path);

    const rawTitle = doc.get('title');
    const title = typeof rawTitle === 'string' ? rawTitle : '';
    const extras = extraFields.filter(
      (field) =>
        typeof doc.get(field) === 'string' && String(doc.get(field)).trim(),
    );
    const source: CaseTranslation = { title, body: body.trim() };
    for (const field of extras) source[field] = String(doc.get(field));

    if (!title.trim() || !source.body) {
      console.warn(`- ${path} (title or body is empty, not translated)`);
      return 'skipped';
    }

    const currentHash = hashSource(source, extras);
    const storedHash = doc.get('translatedFrom') as string | undefined;

    const committed = (doc.toJS() as { translations: Record<string, unknown> })
      .translations;

    const translationsAreCurrent = storedHash === currentHash;

    const block: CacheBlock = cache[path] ?? {};
    const neverTranslated = blockIsEmpty(block);
    cache[path] = block;

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
        systemPrompt: buildCasePrompt(locale, extras),
        apiKey,
        model,
      });
      requests += result.requests;
      for (const key of result.used) used.add(key);

      const translation = result.value as CaseTranslation;
      assertSafeTranslation(source, translation, '');

      if (JSON.stringify(existing) !== JSON.stringify(translation)) {
        translationsNode.set(locale, translation);
        wrote = true;
      }
    }

    cache[path] = Object.fromEntries(
      Object.entries(block).filter(([key]) => used.has(key)),
    );

    if (storedHash !== currentHash) {
      doc.set('translatedFrom', currentHash);
      wrote = true;
    }
    if (wrote) {
      writeFileSync(
        path,
        `---\n${doc.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`,
      );
    }

    if (requests > 0) return 'translated';
    return wrote ? 'backfilled' : 'skipped';
  }

  async function run(caseDirs: readonly string[]): Promise<number> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('Missing env var: OPENAI_API_KEY');
      return 1;
    }

    const files: string[] = [];
    for (const dir of caseDirs) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        files.push(join(dir, entry.name, 'index.md'));
      }
    }

    let cache: CacheFile;
    try {
      cache = loadCache(cachePath);
    } catch (err) {
      console.error(`✗ ${cachePath}: ${errorMessage(err)}`);
      return 1;
    }
    console.log(`Found ${files.length} case files.`);
    let translated = 0;
    let backfilled = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const result = await processFile(file, apiKey, cache);
        if (result === 'translated') {
          translated++;
          console.log(`✓ ${file}`);
        } else if (result === 'backfilled') {
          backfilled++;
          console.log(`~ ${file} (recorded hash, no translation needed)`);
        } else {
          skipped++;
          console.log(`- ${file} (nothing to translate)`);
        }
      } catch (err) {
        failed++;
        console.error(`✗ ${file}: ${errorMessage(err)}`);
      }
      saveCache(cachePath, cache);
    }

    if (failed === 0) {
      pruneMissingFiles(cache);
      saveCache(cachePath, cache);
    }

    console.log(
      `\nDone: ${translated} translated, ${backfilled} backfilled, ${skipped} skipped, ${failed} failed.`,
    );
    return failed > 0 ? 1 : 0;
  }

  return { processFile, run };
}
