// Backfills en/sr/es/de translations for every case, and re-translates all
// four whenever the ru source (title+body) changes since the last run —
// admin only ever writes ru. Two callers:
// - .github/workflows/translate-cases.yml, after every push touching a case
//   file — this is the actual "translate button" Keystatic has no field
//   type to host (see keystatic.config.ts), so it runs itself instead.
// - a one-off manual run, e.g. after editing keystatic.config.ts/this script:
//   node --env-file=.env --experimental-strip-types scripts/translate-cases.ts
export {};

import assert from 'node:assert';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument, isMap, type YAMLMap } from 'yaml';
import { TRANSLATABLE_LOCALES, type TranslatableLocale } from '../src/i18n/config.ts';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Missing env var: OPENAI_API_KEY');
  process.exit(1);
}

const CASE_DIRS = ['src/content/cases', 'src/content/autoservice-cases', 'src/content/detailing-cases'];
const TARGET_LOCALES = TRANSLATABLE_LOCALES;
const TARGET_LANGUAGE_NAME: Record<TranslatableLocale, string> = {
  en: 'English',
  sr: 'Serbian (Latin script)',
  es: 'Spanish',
  de: 'German',
};

interface CaseTranslation {
  title: string;
  body: string;
}

// The only place this prompt lives — there is no admin-UI "translate
// button" this duplicates; Keystatic has no field type that can call an
// API from inside its own form (see keystatic.config.ts), which is why
// this script exists at all.
async function translateCase(source: CaseTranslation, targetLocale: TranslatableLocale): Promise<CaseTranslation> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You translate car-sourcing case studies from Russian into ${TARGET_LANGUAGE_NAME[targetLocale]} ` +
            'for approved.rs, a car-sourcing/import/buyback/inspection business based in Belgrade, Serbia. ' +
            'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
            'this case study — never a literal word-for-word translation. Keep markdown formatting (headings, ' +
            'bold, lists) intact. Keep car makes/models, prices, and place names as they would normally appear ' +
            'in the target language. Respond with a JSON object: {"title": string, "body": string}.',
        },
        { role: 'user', content: `Title: ${source.title}\n\nBody:\n${source.body}` },
      ],
    }),
  });

  const data = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`OpenAI translate failed: ${response.status} ${data.error?.message ?? ''}`.trim());

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('translate response missing content');

  const parsed = JSON.parse(content) as Partial<CaseTranslation>;
  if (!parsed.title?.trim() || !parsed.body?.trim()) {
    throw new Error('translate response missing title/body');
  }
  return { title: parsed.title, body: parsed.body };
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('no frontmatter found');
  return { frontmatter: match[1], body: match[2] };
}

// Short fingerprint of the ru source a set of translations was made from —
// stored alongside them so a later run can tell "ru hasn't changed, these
// are still good" from "ru changed, redo all four" without re-translating
// on every single push.
function hashSource(source: CaseTranslation): string {
  return createHash('sha256').update(`${source.title}\n${source.body}`).digest('hex').slice(0, 16);
}

type Action =
  | { kind: 'skip' }
  | { kind: 'backfill' } // no locale needs translating, just record the hash
  | { kind: 'translate'; locales: readonly TranslatableLocale[] };

// Pure decision logic, pulled out of processFile so it's testable without
// touching the filesystem or network — see the self-check below. `hasReal`
// must check actual content, not just key presence: Keystatic's text/
// markdoc fields save as '' when left blank rather than omitting the key,
// so a brand-new case already has `translations.en = { title: '', body: '' }`
// the moment it's created — treating that as "already translated" would
// leave every new case's en/sr/es/de permanently blank.
function decideAction(params: {
  storedHash: string | undefined;
  currentHash: string;
  hasReal: (locale: TranslatableLocale) => boolean;
}): Action {
  const { storedHash, currentHash, hasReal } = params;
  // Only a *present* hash that disagrees means "ru changed since we last
  // translated it" — a missing hash means this file predates hash-tracking
  // (e.g. the original manual backfill), not "ru changed". Treating
  // undefined as stale would overwrite perfectly good existing
  // translations with fresh AI output the very first time this ran.
  const ruChanged = storedHash !== undefined && storedHash !== currentHash;
  const missingLocales = TARGET_LOCALES.filter(l => !hasReal(l));
  const localesToTranslate = ruChanged ? TARGET_LOCALES : missingLocales;

  if (localesToTranslate.length === 0) {
    return storedHash === currentHash ? { kind: 'skip' } : { kind: 'backfill' };
  }
  return { kind: 'translate', locales: localesToTranslate };
}

// The smallest runnable check that fails if decideAction's branching logic
// breaks — no test framework needed for one pure function with no I/O.
function selfCheckDecideAction(): void {
  const hasAll = () => true;
  const hasNone = () => false;

  assert.deepStrictEqual(decideAction({ storedHash: 'a', currentHash: 'a', hasReal: hasAll }), { kind: 'skip' });
  assert.deepStrictEqual(decideAction({ storedHash: undefined, currentHash: 'a', hasReal: hasAll }), { kind: 'backfill' });
  assert.deepStrictEqual(
    decideAction({ storedHash: undefined, currentHash: 'a', hasReal: hasNone }),
    { kind: 'translate', locales: TARGET_LOCALES },
  );
  assert.deepStrictEqual(
    decideAction({ storedHash: 'old', currentHash: 'new', hasReal: hasAll }),
    { kind: 'translate', locales: TARGET_LOCALES },
  );
  const missingEs = (l: TranslatableLocale) => l !== 'es';
  assert.deepStrictEqual(
    decideAction({ storedHash: 'a', currentHash: 'a', hasReal: missingEs }),
    { kind: 'translate', locales: ['es'] },
  );
}

function hasRealTranslation(translationsNode: YAMLMap, locale: TranslatableLocale): boolean {
  const entry = translationsNode.get(locale, true);
  if (!isMap(entry)) return false;
  const title = entry.get('title');
  const body = entry.get('body');
  return typeof title === 'string' && title.trim().length > 0
    && typeof body === 'string' && body.trim().length > 0;
}

// Unlike decideAction, this one does touch a real (if tiny) parsed YAML
// document — worth its own check since it's the piece that actually reads
// the on-disk shape Keystatic produces (blank fields saved as '', not
// omitted), and a change to how it reads the map (e.g. swapping
// `entry.get('title')` for `entry.get('title', true)`, which returns a
// Scalar node instead of a string) would silently break `typeof === 'string'`
// without decideAction's own self-check ever noticing.
function selfCheckHasRealTranslation(): void {
  const fixture = parseDocument(
    'translations:\n  en:\n    title: Real Title\n    body: Real body\n  sr:\n    title: ""\n    body: ""\n  es:\n    title: Only Title\n',
  );
  const translations = fixture.get('translations', true);
  assert.ok(isMap(translations));
  assert.strictEqual(hasRealTranslation(translations, 'en'), true);
  assert.strictEqual(hasRealTranslation(translations, 'sr'), false, 'blank title/body must not count as translated');
  assert.strictEqual(hasRealTranslation(translations, 'es'), false, 'missing body must not count as translated');
  assert.strictEqual(hasRealTranslation(translations, 'de'), false, 'a locale absent entirely must not count as translated');
}

async function processFile(path: string): Promise<'translated' | 'backfilled' | 'skipped'> {
  const raw = readFileSync(path, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const doc = parseDocument(frontmatter);

  let translationsNode = doc.get('translations', true);
  if (translationsNode === undefined) {
    doc.set('translations', doc.createNode({}));
    translationsNode = doc.get('translations', true);
  }
  if (!isMap(translationsNode)) throw new Error(`${path}: "translations" is not a map`);

  const title = String(doc.get('title'));
  const source: CaseTranslation = { title, body: body.trim() };
  const currentHash = hashSource(source);
  const storedHash = doc.get('translatedFrom') as string | undefined;

  const action = decideAction({
    storedHash,
    currentHash,
    hasReal: locale => hasRealTranslation(translationsNode, locale),
  });

  if (action.kind === 'skip') return 'skipped';

  if (action.kind === 'backfill') {
    // Nothing missing and ru didn't change — just a file that predates
    // hash-tracking. Record the hash so future runs have a real baseline,
    // without touching any translation.
    doc.set('translatedFrom', currentHash);
    writeFileSync(path, `---\n${doc.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`);
    return 'backfilled';
  }

  for (const locale of action.locales) {
    const translation = await translateCase(source, locale);
    translationsNode.set(locale, translation);
  }
  doc.set('translatedFrom', currentHash);

  const newFrontmatter = doc.toString({ lineWidth: 0 }).trimEnd();
  writeFileSync(path, `---\n${newFrontmatter}\n---\n${body}`);
  return 'translated';
}

async function main() {
  selfCheckDecideAction();
  selfCheckHasRealTranslation();

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
      const result = await processFile(file);
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
      console.error(`✗ ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDone: ${translated} translated, ${backfilled} backfilled, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

await main();
