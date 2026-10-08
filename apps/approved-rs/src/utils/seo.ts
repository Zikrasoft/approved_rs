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
import { localeConfig, type Locale } from '@/i18n/config';
import type { CountryScopedServiceSlug } from './labels';
import { SITE_NAME } from './constants';
import { getMetaTemplates } from '@/i18n/content/meta';

export const ogImageFor = (
  baseUrl: string,
  slug: string,
  locale: Locale,
): string => `${baseUrl}/og/${slug}${localeConfig.ogSuffix[locale]}.png`;

// TODO: vehicle-import has no OG image of its own yet and borrows vehicle-sourcing's.
export const placeholderOgImage = (baseUrl: string, locale: Locale): string =>
  ogImageFor(baseUrl, 'vehicle-sourcing', locale);

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
): Pick<MetaProps, 'title' | 'description'> {
  const { country, city, locale } = options;
  const location = buildLocation(locale, country, city);
  const { title, description } = getMetaTemplates(locale)[service](location);

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
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
