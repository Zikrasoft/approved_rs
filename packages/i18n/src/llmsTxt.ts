import { z } from 'zod';

export interface LlmsSection {
  heading: string;
  items: string[];
}

export const llmsHeadingsSchema = z
  .object({
    keyFacts: z.string(),
    other: z.string(),
    languages: z.string(),
  })
  .strict();

export type LlmsHeadings = z.infer<typeof llmsHeadingsSchema>;

export interface LlmsEntry {
  label: string;
  href: string;
  note?: string;
}

export interface LlmsLinkList {
  heading: string;
  index: LlmsEntry;
  entries: LlmsEntry[];
}

export interface BrandLlmsInput<L extends string> {
  site: { name: string; url: string; summary: string };
  headings: LlmsHeadings;
  facts: string[];
  lists: LlmsLinkList[];
  other: LlmsEntry[];
  locales: readonly L[];
  locale: L;
}

const escapeLabel = (label: string): string => label.replace(/[[\]]/g, '\\$&');

export const llmsLink = (label: string, url: string, note?: string): string => {
  const link = `- [${escapeLabel(label)}](${url})`;
  return note ? `${link} — ${note}` : link;
};

const entryLine = ({ label, href, note }: LlmsEntry): string =>
  llmsLink(label, href, note);

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

export function renderBrandLlmsTxt<L extends string>(
  input: BrandLlmsInput<L>,
): string {
  const { site, headings, locales, locale } = input;
  return renderLlmsTxt(site.name, site.summary, [
    { heading: headings.keyFacts, items: input.facts },
    ...input.lists.map((list) => ({
      heading: list.heading,
      items: [list.index, ...list.entries].map(entryLine),
    })),
    { heading: headings.other, items: input.other.map(entryLine) },
    {
      heading: headings.languages,
      items: llmsLanguageLinks(site.url, locales, locale),
    },
  ]);
}
