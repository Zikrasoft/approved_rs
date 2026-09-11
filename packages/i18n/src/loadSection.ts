import { parse as parseYaml } from 'yaml';
import type { ZodObject, z } from 'zod';
import type { LocaleSetOptions } from './locales.ts';

export function createSectionLoader<L extends string, D extends L>({
  defaultLocale,
}: LocaleSetOptions<L, D>) {
  return function loadSection<S extends ZodObject>(
    schema: S,
    yamlText: string,
  ): (locale: L) => z.infer<S> {
    type T = z.infer<S>;
    const fields = schema.keyof().options as readonly string[];
    const raw = parseYaml(yamlText) as Record<string, unknown>;
    const source = schema.parse(
      Object.fromEntries(fields.map((field) => [field, raw[field]])),
    ) as T;

    const translations = new Map<string, T>();
    const rawTranslations = raw.translations as
      Record<string, unknown> | undefined;
    if (rawTranslations) {
      for (const [locale, value] of Object.entries(rawTranslations)) {
        const result = schema.safeParse(value);
        if (result.success) translations.set(locale, result.data as T);
      }
    }

    return (locale) =>
      locale === defaultLocale ? source : (translations.get(locale) ?? source);
  };
}
