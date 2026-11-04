export interface AiCatalogInput<L extends string> {
  site: { name: string; url: string };
  locales: readonly L[];
  summary: (locale: L) => string;
}

export function renderAiCatalog<L extends string>({
  site,
  locales,
  summary,
}: AiCatalogInput<L>) {
  const host = new URL(site.url).host;
  return {
    specVersion: '1.0',
    host: { displayName: site.name, identifier: host },
    entries: locales.map((locale) => ({
      identifier: `urn:air:${host}:knowledge:llms-txt-${locale}`,
      displayName: `${site.name} llms.txt (${locale})`,
      type: 'text/plain',
      url: `${site.url}/${locale}/llms.txt`,
      description: summary(locale),
    })),
  };
}
