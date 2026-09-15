export interface LlmsSection {
  heading: string;
  items: string[];
}

export interface LlmsHeadings {
  keyFacts: string;
  other: string;
  languages: string;
}

export const LLMS_HEADINGS: Record<
  'ru' | 'en' | 'sr' | 'es' | 'de',
  LlmsHeadings
> = {
  ru: {
    keyFacts: 'Ключевые факты',
    other: 'Прочее',
    languages: 'Другие языки',
  },
  en: {
    keyFacts: 'Key Facts',
    other: 'Other',
    languages: 'Other Languages',
  },
  sr: {
    keyFacts: 'Ključne činjenice',
    other: 'Ostalo',
    languages: 'Drugi jezici',
  },
  es: {
    keyFacts: 'Datos clave',
    other: 'Otros',
    languages: 'Otros idiomas',
  },
  de: {
    keyFacts: 'Wichtige Fakten',
    other: 'Sonstiges',
    languages: 'Weitere Sprachen',
  },
};

const escapeLabel = (label: string): string => label.replace(/[[\]]/g, '\\$&');

export const llmsLink = (label: string, url: string, note?: string): string => {
  const link = `- [${escapeLabel(label)}](${url})`;
  return note ? `${link} — ${note}` : link;
};

export function llmsLanguageLinks<L extends string>(
  siteUrl: string,
  locales: readonly L[],
  current: L,
): string[] {
  return locales
    .filter((locale) => locale !== current)
    .map((locale) => `- ${siteUrl}/${locale}/llms.txt`);
}

export function renderLlmsTxt(
  title: string,
  summary: string,
  sections: LlmsSection[],
): string {
  const lines = [`# ${title}`, '', `> ${summary}`];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    lines.push('', `## ${section.heading}`, '', ...section.items);
  }
  return lines.join('\n') + '\n';
}
