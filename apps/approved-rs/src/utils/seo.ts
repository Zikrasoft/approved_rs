export interface MetaProps {
  title: string;
  description: string;
  noindex?: boolean;
  ogImage?: string;
}

interface MetaOptions {
  country?: Country;
  city?: City;
  locale: Locale;
}

import { marked } from 'marked';
import { articleSchema, serviceSchema } from '@podbor/site-kit';
import type { Country, City } from './geo';
import { OG_SUFFIX, type Locale } from '@/i18n/config';
import type { CountryScopedServiceSlug } from './labels';
import { SITE_NAME, SITE_URL } from './constants';
import { getMetaTemplates } from '@/i18n/content/meta';

export const ogImageFor = (
  baseUrl: string,
  slug: string,
  locale: Locale,
): string => `${baseUrl}/og/${slug}${OG_SUFFIX[locale]}.png`;

// TODO: vehicle-import has no OG image of its own yet and borrows vehicle-sourcing's.
export const placeholderOgImage = (baseUrl: string, locale: Locale): string =>
  ogImageFor(baseUrl, 'vehicle-sourcing', locale);

// Assumes every current country/city takes the Serbian preposition "u"
// (locative-in). None of the 4 countries / 11 cities in countries.json /
// cities.json need "na" instead — if a future place does (e.g. an island or
// region), this needs a per-place preposition field, not a hardcoded one.
const SIMPLE_LOCATION_PREPOSITION: Record<'en' | 'es' | 'de', string> = {
  en: 'in',
  es: 'en',
  de: 'in',
};

export function buildLocation(
  locale: Locale,
  country?: Country,
  city?: City,
): string {
  if (locale === 'ru' || locale === 'sr') {
    const form = city
      ? city[locale].nameLocative
      : country![locale].nameLocative;
    // Russian takes "во" before в/ф + consonant ("во Франции"), "в" otherwise.
    const preposition =
      locale === 'sr'
        ? 'u'
        : /^[вф][бвгджзклмнпрстфхцчшщ]/i.test(form)
          ? 'во'
          : 'в';
    return `${preposition} ${form}`;
  }
  const name = city ? city[locale].name : country![locale].name;
  return `${SIMPLE_LOCATION_PREPOSITION[locale]} ${name}`;
}

export function generateMeta(
  service: CountryScopedServiceSlug,
  options: MetaOptions,
): MetaProps {
  const { country, city, locale } = options;
  const ogImage = ogImageFor(SITE_URL, service, locale);
  const location = buildLocation(locale, country, city);
  const { title, description } = getMetaTemplates(locale)[service](location);

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    ogImage,
  };
}

const ORGANIZATION = { '@type': 'Organization', name: SITE_NAME };

export function generateServiceSchema(
  name: string,
  areaServed: string | string[],
  url: string,
) {
  return serviceSchema({ name, provider: ORGANIZATION, areaServed, url });
}

// Homepage/business-entity schema. Organization (not LocalBusiness — no address,
// no fixed service location) with sameAs pointing at the actual public profiles
// and a contactPoint for the real (Telegram-only) contact channel, instead of
// fabricating an address/telephone/geo the business doesn't have.
export function generateOrganizationSchema(options: {
  url: string;
  description: string;
  areaServed: string[];
  sameAs: string[];
  contactUrl: string;
}) {
  const { url, description, areaServed, sameAs, contactUrl } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    description,
    url,
    logo: `${url}/apple-touch-icon.png`,
    areaServed,
    sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: contactUrl,
      availableLanguage: ['Russian', 'English'],
    },
  };
}

const inlineParser = new marked.Parser();
const textRenderer = new marked.TextRenderer();

// Case bodies open with a hand-written, case-specific hook line — use it instead
// of a templated description so each case page reads as unique, not boilerplate.
// marked's TextRenderer strips every markdown construct down to plain text —
// unlike a hand-rolled regex, it also handles a link's `[text](url)` syntax
// (a regex-only version left the raw `(url)` in the SEO description). The
// top-level `marked.parseInline()` convenience function only accepts a full
// Renderer, not a TextRenderer, so this goes through Lexer/Parser directly.
export function excerptFromMarkdown(markdown: string, maxLen = 140): string {
  const firstParagraph =
    markdown
      .trim()
      .split(/\n\s*\n/)
      .find((block) => !/^#{1,6}\s/.test(block.trim())) ?? '';
  const tokens = marked.Lexer.lexInline(firstParagraph);
  const plain = inlineParser
    .parseInline(tokens, textRenderer)
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export function generateArticleSchema(options: {
  headline: string;
  description: string;
  image?: string;
  datePublished: Date;
  url: string;
}) {
  return articleSchema({ ...options, publisher: ORGANIZATION });
}
