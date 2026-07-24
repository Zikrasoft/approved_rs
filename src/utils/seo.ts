export interface MetaProps {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

interface CountryRef {
  name: string;
  nameGenitive: string;
  nameLocative: string;
  nameAccusative?: string;
}

interface CityRef {
  name: string;
  nameLocative: string;
}

interface MetaOptions {
  country?: CountryRef;
  city?: CityRef;
  fromCountry?: CountryRef;
  toCountry?: CountryRef;
  baseUrl: string;
  path: string;
}

import { SITE_NAME } from './constants';

export function generateMeta(
  service: 'autopodbor' | 'delivery' | 'vykup' | 'proverka' | 'combined',
  options: MetaOptions
): MetaProps {
  const { country, city, fromCountry, toCountry, baseUrl, path } = options;
  const canonical = `${baseUrl}${path}`;

  switch (service) {
    case 'autopodbor': {
      const location = city
        ? `в ${city.nameLocative}`
        : `в ${country!.nameLocative}`;
      return {
        title: `Автоподбор ${location} — подберём авто под ключ | ${SITE_NAME}`,
        description: `Профессиональный автоподбор ${location}. Проверка, сопровождение сделки, помощь с документами. Оставьте заявку — свяжемся в Telegram.`,
        canonical,
      };
    }
    case 'delivery': {
      return {
        title: `Доставка авто из ${fromCountry!.nameGenitive} в ${toCountry!.nameAccusative} — цены и сроки | ${SITE_NAME}`,
        description: `Доставка автомобилей из ${fromCountry!.nameGenitive} в ${toCountry!.nameAccusative}. Таможенное оформление, транспортировка, страховка. Срок 7–14 дней.`,
        canonical,
      };
    }
    case 'vykup': {
      return {
        title: `Выкуп авто в ${country!.nameLocative} на иностранных номерах — срочно | ${SITE_NAME}`,
        description: `Срочный выкуп автомобилей в ${country!.nameLocative}. Российские, европейские номера. Оценка онлайн, оформление за 1 день, перевод в день сделки.`,
        canonical,
      };
    }
    case 'proverka': {
      return {
        title: `Проверка авто в ${country!.nameLocative} перед покупкой | ${SITE_NAME}`,
        description: `Независимая проверка автомобиля в ${country!.nameLocative}. Выезд эксперта, осмотр кузова и ходовой, отчёт. Защитите себя от покупки битого авто.`,
        canonical,
      };
    }
    case 'combined': {
      return {
        title: `Подбор и доставка авто из ${country!.nameGenitive} под ключ | ${SITE_NAME}`,
        description: `Подберём автомобиль в ${country!.nameLocative} и привезём к вам. Полное сопровождение: поиск, проверка, таможня, доставка.`,
        canonical,
      };
    }
  }
}

export function generateServiceSchema(name: string, areaServed: string | string[], url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    provider: { '@type': 'LocalBusiness', name: SITE_NAME },
    areaServed,
    url,
  };
}

// Case bodies open with a hand-written, case-specific hook line — use it instead
// of a templated description so each case page reads as unique, not boilerplate.
export function excerptFromMarkdown(markdown: string, maxLen = 140): string {
  const firstParagraph = markdown.trim().split(/\n\s*\n/)[0] ?? '';
  const plain = firstParagraph
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[*_`]/g, '')
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
  const { headline, description, image, datePublished, url } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    image,
    datePublished: datePublished.toISOString(),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: url,
  };
}
