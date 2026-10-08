export function faqPageSchema(items: readonly { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function jsonLdText(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export type PageSchema = object | ((canonical: string) => object);

export function pageSchema(schema: PageSchema, canonical: string): object {
  return typeof schema === 'function' ? schema(canonical) : schema;
}

export type SchemaRef = Record<string, unknown>;

export function citySchema(name: string) {
  return { '@type': 'City', name };
}

export function productSchema(options: {
  name: string;
  image?: string;
  brand?: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  condition: string;
  url: string;
}) {
  const { name, image, brand, description, price, currency, inStock } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    image,
    brand: brand === undefined ? undefined : { '@type': 'Brand', name: brand },
    description,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`,
      itemCondition: `https://schema.org/${options.condition}`,
      url: options.url,
    },
  };
}

export function serviceSchema(options: {
  name: string;
  serviceType?: string;
  description?: string;
  provider: SchemaRef;
  areaServed: unknown;
  url: string;
}) {
  const { name, serviceType, description, provider, areaServed, url } = options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    serviceType,
    description,
    provider,
    areaServed,
    url,
  };
}

export function articleSchema(options: {
  headline: string;
  description?: string;
  image?: string;
  datePublished: Date;
  publisher: SchemaRef;
  url: string;
}) {
  const { headline, description, image, datePublished, publisher, url } =
    options;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    image,
    datePublished: datePublished.toISOString(),
    author: publisher,
    publisher,
    mainEntityOfPage: url,
  };
}

export interface BusinessAddress {
  street: string;
  district: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface OpeningHours {
  days: readonly string[];
  opens: string;
  closes: string;
}

export function localBusinessSchema({
  type,
  id,
  name,
  legalName,
  url,
  image,
  logo,
  description,
  telephone,
  address,
  hasMap,
  areaServed,
  currenciesAccepted,
  openingHours,
  sameAs,
}: {
  type: string;
  id: string;
  name: string;
  legalName?: string;
  url: string;
  image?: string;
  logo?: string;
  description?: string;
  telephone?: string;
  address: BusinessAddress;
  hasMap?: string;
  areaServed?: unknown;
  currenciesAccepted?: string;
  openingHours?: readonly OpeningHours[];
  sameAs?: readonly string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': id,
    name,
    legalName,
    url,
    image,
    logo,
    description,
    telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.district,
      addressCountry: address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: address.lat,
      longitude: address.lon,
    },
    hasMap,
    areaServed,
    currenciesAccepted,
    openingHoursSpecification: openingHours?.map(({ days, opens, closes }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days,
      opens,
      closes,
    })),
    sameAs,
  };
}
