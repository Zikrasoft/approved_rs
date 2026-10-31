import { parse as parseYaml } from 'yaml';
import type { ZodObject, z } from 'zod';
import { isPlainObject } from './isPlainObject.ts';
import { SOURCE_LOCALE } from './locales.ts';
import { PLACEHOLDER } from './withPlaceholder.ts';

function mergeOverSource(source: unknown, translation: unknown): unknown {
  if (!isPlainObject(source) || !isPlainObject(translation)) return translation;

  const merged = new Map(Object.entries(source));
  for (const [key, value] of Object.entries(translation)) {
    merged.set(key, mergeOverSource(merged.get(key), value));
  }
  return Object.fromEntries(merged);
}

const placeholdersOf = (text: string): string =>
  [...new Set(text.match(PLACEHOLDER))].sort().join(' ');

function keepSourcePlaceholders(
  source: unknown,
  translated: unknown,
  path: string,
  mismatched: string[],
): unknown {
  if (typeof translated === 'string') {
    if (
      typeof source !== 'string' ||
      placeholdersOf(source) === placeholdersOf(translated)
    ) {
      return translated;
    }
    mismatched.push(path);
    return source;
  }
  const children = (source as Record<string, unknown> | undefined) ?? {};
  if (Array.isArray(translated)) {
    return translated.map((item, i) =>
      keepSourcePlaceholders(children[i], item, `${path}[${i}]`, mismatched),
    );
  }
  if (!isPlainObject(translated)) return translated;
  return Object.fromEntries(
    Object.entries(translated).map(([key, value]) => [
      key,
      keepSourcePlaceholders(
        children[key],
        value,
        path ? `${path}.${key}` : key,
        mismatched,
      ),
    ]),
  );
}

const issueLocation = (issue: z.core.$ZodIssue): string =>
  'keys' in issue ? (issue.keys as string[]).join(', ') : issue.path.join('.');

export function createSectionLoader<L extends string>() {
  return function loadSection<S extends ZodObject>(
    schema: S,
    yamlText: string,
  ): (locale: L) => z.infer<S> {
    type T = z.infer<S>;
    const fields = schema.keyof().options as readonly string[];
    const raw = parseYaml(yamlText) as Record<string, unknown>;
    const rawSource = Object.fromEntries(
      fields.map((field) => [field, raw[field]]),
    );
    const source = schema.parse(rawSource) as T;

    const translations = new Map<string, T>();
    const rawTranslations = raw.translations as
      Record<string, unknown> | undefined;
    if (rawTranslations) {
      for (const [locale, value] of Object.entries(rawTranslations)) {
        const asWritten = schema.safeParse(value);
        const result = asWritten.success
          ? asWritten
          : schema.safeParse(mergeOverSource(rawSource, value));
        if (!asWritten.success && result.success) {
          console.warn(
            `[i18n] ${locale}: inheriting source values for`,
            asWritten.error.issues
              .map((issue) => issue.path.join('.'))
              .join(', '),
          );
        }
        if (result.success) {
          const mismatched: string[] = [];
          translations.set(
            locale,
            keepSourcePlaceholders(source, result.data, '', mismatched) as T,
          );
          if (mismatched.length > 0) {
            console.warn(
              `[i18n] ${locale}: placeholders differ from ${SOURCE_LOCALE}, serving ${SOURCE_LOCALE} for`,
              mismatched.join(', '),
            );
          }
        } else {
          console.warn(
            `[i18n] ${locale}: dropped, falling back to ${SOURCE_LOCALE} —`,
            result.error.issues.map(issueLocation).join(', '),
          );
        }
      }
    }

    return (locale) =>
      locale === SOURCE_LOCALE ? source : (translations.get(locale) ?? source);
  };
}
