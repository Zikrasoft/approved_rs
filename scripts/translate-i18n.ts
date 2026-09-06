// Backfills en/sr/es/de for every i18n YAML section listed in SECTIONS
// below, and re-translates a section whenever its ru fields change since
// the last run — admin only ever hand-writes ru, directly in the YAML file.
// A registry-driven script rather than one per section, so a new i18n
// section (FAQ, home page copy, ...) is a new SECTIONS entry + a zod
// schema, not a new script. Two callers:
// - .github/workflows/translate.yml, after every push touching one of the
//   section files.
// - a one-off manual run, e.g. after editing this script or backfilling a
//   new locale:
//   node --env-file=.env --experimental-strip-types scripts/translate-i18n.ts
export {};

import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import type { ZodObject } from 'zod';
import { type TranslatableLocale } from '../src/i18n/config.ts';
import { decideAction } from './lib/translateDecision.ts';
import { hasRealTranslation } from './lib/hasRealTranslation.ts';
import { assertSafeTranslation } from './lib/assertSafeTranslation.ts';
import { sha256Hex } from './lib/sha256Hex.ts';
import { getOrCreateTranslationsMap } from './lib/getOrCreateTranslationsMap.ts';
import { dictionaryContentSchema } from '../src/i18n/dictionaryContentSchema.ts';
import { faqContentSchema } from '../src/i18n/content/faqContentSchema.ts';
import { leadFormContentSchema } from '../src/i18n/content/leadFormContentSchema.ts';
import { homeContentSchema } from '../src/i18n/content/homeContentSchema.ts';
import { pagesContentSchema } from '../src/i18n/content/pagesContentSchema.ts';
import { promoBannersContentSchema } from '../src/i18n/content/promoBannersContentSchema.ts';
import { metaContentSchema } from '../src/i18n/content/metaContentSchema.ts';
import { servicesContentSchema } from '../src/i18n/content/servicesContentSchema.ts';
import { callOpenAiJson, TARGET_LANGUAGE_NAME } from './lib/openaiChat.ts';

export interface Section {
  /** YAML file path, relative to the repo root. */
  path: string;
  /**
   * Top-level keys that hold the ru content itself, as opposed to the
   * sidecar bookkeeping fields (translations/translatedFrom) the bot owns.
   * Explicit list rather than "everything except translations/
   * translatedFrom" so a typo'd sidecar field name fails loudly instead of
   * silently getting treated as translatable content.
   */
  fields: readonly string[];
  /** Validates both the ru source and every translated response. */
  schema: ZodObject;
  /** What this section's strings are, for the translation prompt. */
  promptSubject: string;
}

export const SECTIONS: readonly Section[] = [
  {
    path: 'src/content/i18n/dictionary.yaml',
    fields: ['nav', 'header', 'footer', 'common'],
    schema: dictionaryContentSchema,
    promptSubject: 'UI copy (navigation, header, footer, and shared labels)',
  },
  {
    path: 'src/content/i18n/faq.yaml',
    fields: [
      'vehicle-sourcing',
      'vehicle-import',
      'vehicle-buyback',
      'vehicle-inspection',
      'autoServiceBelgrade',
      'detailingBelgrade',
      'general',
      'cityExpert',
    ],
    schema: faqContentSchema,
    promptSubject: 'frequently-asked-question entries (question + answer)',
  },
  {
    path: 'src/content/i18n/leadForm.yaml',
    fields: leadFormContentSchema.keyof().options,
    schema: leadFormContentSchema,
    promptSubject:
      'lead-capture form UI copy (labels, placeholders, error messages)',
  },
  {
    path: 'src/content/i18n/home.yaml',
    fields: homeContentSchema.keyof().options,
    schema: homeContentSchema,
    promptSubject: 'home page copy (hero, journey steps, testimonials, CTAs)',
  },
  {
    path: 'src/content/i18n/pages.yaml',
    fields: pagesContentSchema.keyof().options,
    schema: pagesContentSchema,
    promptSubject:
      'copy for the contacts/privacy-policy/thank-you/case-listing pages',
  },
  {
    path: 'src/content/i18n/promoBanners.yaml',
    fields: promoBannersContentSchema.keyof().options,
    schema: promoBannersContentSchema,
    promptSubject:
      'SEO-keyword-dense promotional banner copy shown on case-detail pages (markdown **bold** spans mark the keyword phrases — keep them)',
  },
  {
    path: 'src/content/i18n/meta.yaml',
    fields: metaContentSchema.keyof().options,
    schema: metaContentSchema,
    promptSubject:
      'SEO <title>/<meta description> templates for service pages (contain the literal token {location})',
  },
  {
    path: 'src/content/i18n/services.yaml',
    fields: servicesContentSchema.keyof().options,
    schema: servicesContentSchema,
    promptSubject:
      'service page copy (sourcing/buyback/import/inspection/auto-service/detailing) — many strings contain literal placeholder tokens like {location}, {cityLocation}, {countryName}, {destinations}, {name}, {countryLocation}, {countryGenitiveOrName}',
  },
];

type SectionData = Record<string, unknown>;

// Plain JSON.stringify is fine here (not a canonical/sorted serialization):
// a section's key order only changes when someone reorders fields in the
// YAML file, which is itself a real edit worth a retranslation pass, not a
// false positive worth guarding against.
export function hashSource(data: SectionData): string {
  return sha256Hex(JSON.stringify(data));
}

// The only place this prompt lives. `apiKey` is injected (not read from
// process.env here) so this function stays callable from tests without an
// OPENAI_API_KEY in the environment.
export async function translateSection(
  data: SectionData,
  targetLocale: TranslatableLocale,
  apiKey: string,
  section: Pick<Section, 'schema' | 'promptSubject'>,
): Promise<SectionData> {
  const raw = await callOpenAiJson({
    apiKey,
    systemPrompt:
      `You translate ${section.promptSubject} from Russian into ${TARGET_LANGUAGE_NAME[targetLocale]} ` +
      'for approved.rs, a car-sourcing/import/buyback/inspection business based in Belgrade, Serbia. ' +
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

export async function processSection(
  section: Section,
  apiKey: string,
): Promise<'translated' | 'backfilled' | 'skipped'> {
  const doc = parseDocument(readFileSync(section.path, 'utf-8'));
  const translationsNode = getOrCreateTranslationsMap(doc, section.path);

  // doc.get(field) returns a live YAMLMap/YAMLSeq node, not plain data —
  // toJS() resolves the whole document to plain JS values once so hashing
  // and schema validation below work against real objects/arrays/strings,
  // not yaml's internal node classes (whose own enumerable properties are
  // unrelated to the YAML keys they represent).
  const plain = doc.toJS() as SectionData;
  const rawSource: SectionData = {};
  for (const field of section.fields) {
    if (plain[field] !== undefined) rawSource[field] = plain[field];
  }
  // Fails loudly here — before deciding whether translation is even
  // needed — if the ru side itself is malformed (a bad manual YAML edit),
  // rather than surfacing a confusing error deeper in the pipeline or
  // silently sending garbage to OpenAI.
  const source = section.schema.parse(rawSource) as SectionData;
  const currentHash = hashSource(source);
  const storedHash = doc.get('translatedFrom') as string | undefined;

  const action = decideAction({
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
    const translation = await translateSection(source, locale, apiKey, section);
    translationsNode.set(locale, translation);
  }
  doc.set('translatedFrom', currentHash);

  writeFileSync(section.path, doc.toString({ lineWidth: 0 }));
  return 'translated';
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing env var: OPENAI_API_KEY');
    process.exit(1);
  }

  let failed = 0;
  for (const section of SECTIONS) {
    try {
      const result = await processSection(section, apiKey);
      if (result === 'translated') {
        console.log(`✓ ${section.path} (translated)`);
      } else if (result === 'backfilled') {
        console.log(`~ ${section.path} (recorded hash, no translation needed)`);
      } else {
        console.log(`- ${section.path} (up to date)`);
      }
    } catch (err) {
      failed++;
      console.error(
        `✗ ${section.path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (failed > 0) process.exit(1);
}

// Only run when executed directly (`node scripts/translate-i18n.ts`), never
// on import — keeps every export above testable without a real
// OPENAI_API_KEY or filesystem side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
