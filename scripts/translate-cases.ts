// Backfills en/sr/es/de translations for every case, and re-translates all
// four whenever the ru source (title+body) changes since the last run —
// admin only ever writes ru. Two callers:
// - .github/workflows/translate.yml, after every push touching a case
//   file — this is the actual "translate button" Keystatic has no field
//   type to host (see keystatic.config.ts), so it runs itself instead.
// - a one-off manual run, e.g. after editing keystatic.config.ts/this script:
//   node --env-file=.env --experimental-strip-types scripts/translate-cases.ts
export {};

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { TranslatableLocale } from '../src/i18n/config.ts';
import { callOpenAiJson, TARGET_LANGUAGE_NAME } from './lib/openaiChat.ts';
import { decideAction } from './lib/translateDecision.ts';
import { hasRealTranslation } from './lib/hasRealTranslation.ts';
import { assertSafeTranslation } from './lib/assertSafeTranslation.ts';
import { sha256Hex } from './lib/sha256Hex.ts';
import { getOrCreateTranslationsMap } from './lib/getOrCreateTranslationsMap.ts';

const CASE_DIRS = [
  'src/content/cases',
  'src/content/autoservice-cases',
  'src/content/detailing-cases',
];

interface CaseTranslation {
  title: string;
  body: string;
}

const CASE_FIELDS = ['title', 'body'] as const;

// The only place this prompt lives — there is no admin-UI "translate
// button" this duplicates; Keystatic has no field type that can call an
// API from inside its own form (see keystatic.config.ts), which is why
// this script exists at all.
export async function translateCase(
  source: CaseTranslation,
  targetLocale: TranslatableLocale,
  apiKey: string,
): Promise<CaseTranslation> {
  const raw = await callOpenAiJson({
    apiKey,
    systemPrompt:
      `You translate car-sourcing case studies from Russian into ${TARGET_LANGUAGE_NAME[targetLocale]} ` +
      'for approved.rs, a car-sourcing/import/buyback/inspection business based in Belgrade, Serbia. ' +
      'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
      'this case study — never a literal word-for-word translation. Keep markdown formatting (headings, ' +
      'bold, lists) intact. Keep car makes/models, prices, and place names as they would normally appear ' +
      'in the target language. Respond with a JSON object: {"title": string, "body": string}.',
    userContent: `Title: ${source.title}\n\nBody:\n${source.body}`,
  });

  const parsed = raw as Partial<CaseTranslation>;
  if (!parsed.title?.trim() || !parsed.body?.trim()) {
    throw new Error('translate response missing title/body');
  }
  const translation = { title: parsed.title, body: parsed.body };
  assertSafeTranslation(source, translation, '');
  return translation;
}

export function splitFrontmatter(raw: string): {
  frontmatter: string;
  body: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('no frontmatter found');
  return { frontmatter: match[1], body: match[2] };
}

export function hashSource(source: CaseTranslation): string {
  return sha256Hex(`${source.title}\n${source.body}`);
}

export async function processFile(
  path: string,
  apiKey: string,
): Promise<'translated' | 'backfilled' | 'skipped'> {
  const raw = readFileSync(path, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const doc = parseDocument(frontmatter);
  const translationsNode = getOrCreateTranslationsMap(doc, path);

  const title = String(doc.get('title'));
  const source: CaseTranslation = { title, body: body.trim() };
  const currentHash = hashSource(source);
  const storedHash = doc.get('translatedFrom') as string | undefined;

  const action = decideAction({
    storedHash,
    currentHash,
    hasReal: (locale) =>
      hasRealTranslation(translationsNode, locale, CASE_FIELDS),
  });

  if (action.kind === 'skip') return 'skipped';

  if (action.kind === 'backfill') {
    // Nothing missing and ru didn't change — just a file that predates
    // hash-tracking. Record the hash so future runs have a real baseline,
    // without touching any translation.
    doc.set('translatedFrom', currentHash);
    writeFileSync(
      path,
      `---\n${doc.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`,
    );
    return 'backfilled';
  }

  for (const locale of action.locales) {
    const translation = await translateCase(source, locale, apiKey);
    translationsNode.set(locale, translation);
  }
  doc.set('translatedFrom', currentHash);

  const newFrontmatter = doc.toString({ lineWidth: 0 }).trimEnd();
  writeFileSync(path, `---\n${newFrontmatter}\n---\n${body}`);
  return 'translated';
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing env var: OPENAI_API_KEY');
    process.exit(1);
  }

  const files: string[] = [];
  for (const dir of CASE_DIRS) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      files.push(join(dir, entry.name, 'index.md'));
    }
  }

  console.log(`Found ${files.length} case files.`);
  let translated = 0;
  let backfilled = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const result = await processFile(file, apiKey);
      if (result === 'translated') {
        translated++;
        console.log(`✓ ${file}`);
      } else if (result === 'backfilled') {
        backfilled++;
        console.log(`~ ${file} (recorded hash, no translation needed)`);
      } else {
        skipped++;
        console.log(`- ${file} (up to date)`);
      }
    } catch (err) {
      failed++;
      console.error(
        `✗ ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `\nDone: ${translated} translated, ${backfilled} backfilled, ${skipped} skipped, ${failed} failed.`,
  );
  if (failed > 0) process.exit(1);
}

// Only run when executed directly (`node scripts/translate-cases.ts`), never
// on import — keeps every export above testable without a real
// OPENAI_API_KEY or filesystem/network side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
