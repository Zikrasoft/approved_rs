import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { assertSafeTranslation } from './assertSafeTranslation.ts';
import { getOrCreateTranslationsMap } from './getOrCreateTranslationsMap.ts';
import { hasRealTranslation } from './hasRealTranslation.ts';
import { callOpenAiJson } from './openaiChat.ts';
import { sha256Hex } from './sha256Hex.ts';
import { decideAction } from './translateDecision.ts';
import { errorMessage } from './errorMessage.ts';

export interface CaseTranslation {
  title: string;
  body: string;
  [field: string]: string;
}

export type CaseOutcome = 'translated' | 'backfilled' | 'skipped';

const CASE_FIELDS = ['title', 'body'] as const;

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
}: CaseTranslatorOptions<L>) {
  const names = new Map<string, string>(Object.entries<string>(languageName));

  async function translateCase(
    source: CaseTranslation,
    targetLocale: L,
    apiKey: string,
    extras: readonly string[] = [],
  ): Promise<CaseTranslation> {
    const shape = [...CASE_FIELDS, ...extras]
      .map((field) => `"${field}": string`)
      .join(', ');
    const guidance = extras
      .map((field) => FIELD_GUIDANCE[field])
      .filter(Boolean)
      .map((sentence) => ` ${sentence}`)
      .join('');
    const extraLines = extras
      .map((field) => `\n${field}: ${source[field]}`)
      .join('');

    const raw = await callOpenAiJson({
      apiKey,
      model,
      systemPrompt:
        `You translate ${subject} from Russian into ${names.get(targetLocale)} ` +
        `for ${businessDescription}. ` +
        'Translate the MEANING naturally and idiomatically, the way a native speaker would actually write ' +
        'this case study — never a literal word-for-word translation. Keep markdown formatting (headings, ' +
        'bold, lists) intact. Keep car makes/models, prices, and place names as they would normally appear ' +
        `in the target language.${guidance} Respond with a JSON object: {${shape}}.`,
      userContent: `Title: ${source.title}${extraLines}\n\nBody:\n${source.body}`,
    });

    const parsed = raw as Partial<CaseTranslation>;
    if (!parsed.title?.trim() || !parsed.body?.trim()) {
      throw new Error('translate response missing title/body');
    }
    const translation: CaseTranslation = {
      title: parsed.title,
      body: parsed.body,
    };
    for (const field of extras) {
      if (!parsed[field]?.trim()) {
        throw new Error(`translate response missing ${field}`);
      }
      translation[field] = parsed[field];
    }
    assertSafeTranslation(source, translation, '');
    return translation;
  }

  async function processFile(
    path: string,
    apiKey: string,
  ): Promise<CaseOutcome> {
    const raw = readFileSync(path, 'utf-8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const doc = parseDocument(frontmatter);
    const translationsNode = getOrCreateTranslationsMap(doc, path);

    const title = String(doc.get('title'));
    const extras = extraFields.filter(
      (field) =>
        typeof doc.get(field) === 'string' && String(doc.get(field)).trim(),
    );
    const source: CaseTranslation = { title, body: body.trim() };
    for (const field of extras) source[field] = String(doc.get(field));

    const currentHash = hashSource(source, extras);
    const storedHash = doc.get('translatedFrom') as string | undefined;

    const action = decideAction({
      targetLocales,
      storedHash,
      currentHash,
      hasReal: (locale) =>
        hasRealTranslation(translationsNode, locale, [
          ...CASE_FIELDS,
          ...extras,
        ]),
    });

    if (action.kind === 'skip') return 'skipped';

    if (action.kind === 'backfill') {
      doc.set('translatedFrom', currentHash);
      writeFileSync(
        path,
        `---\n${doc.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`,
      );
      return 'backfilled';
    }

    for (const locale of action.locales) {
      const translation = await translateCase(source, locale, apiKey, extras);
      translationsNode.set(locale, translation);
    }
    doc.set('translatedFrom', currentHash);

    const newFrontmatter = doc.toString({ lineWidth: 0 }).trimEnd();
    writeFileSync(path, `---\n${newFrontmatter}\n---\n${body}`);
    return 'translated';
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
        console.error(`✗ ${file}: ${errorMessage(err)}`);
      }
    }

    console.log(
      `\nDone: ${translated} translated, ${backfilled} backfilled, ${skipped} skipped, ${failed} failed.`,
    );
    return failed > 0 ? 1 : 0;
  }

  return { translateCase, processFile, run };
}
