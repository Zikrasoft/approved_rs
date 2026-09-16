import { parse as parseYaml } from 'yaml';
import type { ZodObject, z } from 'zod';
import { isPlainObject } from './isPlainObject.ts';
import { SOURCE_LOCALE } from './locales.ts';

function mergeOverSource(source: unknown, translation: unknown): unknown {
  if (!isPlainObject(source) || !isPlainObject(translation)) return translation;

  const merged = new Map(Object.entries(source));
  for (const [key, value] of Object.entries(translation)) {
    merged.set(key, mergeOverSource(merged.get(key), value));
  }
  return Object.fromEntries(merged);
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
          translations.set(locale, result.data as T);
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
