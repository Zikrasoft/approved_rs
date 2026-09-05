import { parse as parseYaml } from 'yaml';
import type { ZodObject, z } from 'zod';
import type { Locale, TranslatableLocale } from './config';
import { DEFAULT_LOCALE } from './config';

// Shared by every src/i18n/content/*.ts reader (and getI18n.ts) — was the
// same ~15-line "parse YAML, validate ru against the schema, validate each
// present translation, fall back to ru on a bad one" block hand-copied into
// each file. Returns a plain `(locale) => T` getter so most call sites can
// just do `export const getX = loadI18nSection(xSchema, xYaml);` — the few
// with extra per-locale work (gallery templates, {siteName} wrapping, a
// `kind` param, ...) call the getter inside their own wrapper instead. The
// return type is inferred from `schema` (not a separately-specified type
// argument) so passing the wrong schema/type pairing is a type error
// instead of a silent `as T` cast papering over a copy-paste mismatch.
export function loadI18nSection<S extends ZodObject>(
  schema: S,
  yamlText: string,
): (locale: Locale) => z.infer<S> {
  type T = z.infer<S>;
  const fields = schema.keyof().options as readonly string[];
  const raw = parseYaml(yamlText) as Record<string, unknown>;
  // Validated once at module load, not on every call — a bad YAML file
  // (a manual typo, or a translate script bug that slipped through its own
  // validation) fails loudly at build/dev-server startup instead of
  // silently rendering an empty/mistyped string somewhere on the site.
  const ru = schema.parse(
    Object.fromEntries(fields.map((field) => [field, raw[field]])),
  ) as T;

  const translations: Partial<Record<TranslatableLocale, T>> = {};
  const rawTranslations = raw.translations as
    Record<string, unknown> | undefined;
  if (rawTranslations) {
    for (const locale of Object.keys(rawTranslations) as TranslatableLocale[]) {
      const result = schema.safeParse(rawTranslations[locale]);
      if (result.success) translations[locale] = result.data as T;
      // A locale that's present but fails validation (e.g. mid-write from a
      // future script bug) falls back to ru below rather than throwing — the
      // rest of the site should keep working in other locales.
    }
  }

  return (locale) =>
    locale === DEFAULT_LOCALE
      ? ru
      : (translations[locale as TranslatableLocale] ?? ru);
}
