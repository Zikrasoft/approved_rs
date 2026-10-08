import type { ZodObject, z } from 'zod';

type RegistryEntries = readonly {
  key: string;
  path: string;
  schema: ZodObject;
}[];

export type ContentOf<S extends RegistryEntries> = {
  [E in S[number] as E['key']]: z.infer<E['schema']>;
};

type SectionLoader<L extends string> = <T extends ZodObject>(
  schema: T,
  yamlText: string,
) => (locale: L) => z.infer<T>;

export function createContent<
  L extends string,
  const S extends RegistryEntries,
>(
  loadSection: SectionLoader<L>,
  sections: S,
  files: Record<string, string>,
): (locale: L) => ContentOf<S> {
  const loaders = sections.map(({ key, path, schema }) => {
    const yamlText = files[`/${path}`];
    if (yamlText === undefined) {
      throw new Error(`[i18n] no YAML file matches the registry path ${path}`);
    }
    return [key, loadSection(schema, yamlText)] as const;
  });

  const byLocale = new Map<L, ContentOf<S>>();
  return (locale) => {
    const cached = byLocale.get(locale);
    if (cached) return cached;
    const built = Object.fromEntries(
      loaders.map(([key, get]) => [key, get(locale)]),
    ) as ContentOf<S>;
    byLocale.set(locale, built);
    return built;
  };
}
