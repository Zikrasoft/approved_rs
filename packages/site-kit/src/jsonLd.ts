export function jsonLdText(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export type SchemaRef = Record<string, unknown>;

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

export function localBusinessSchema(options: {
  type: string;
  id: string;
  name: string;
  legalName: string;
  url: string;
  image: string;
  logo: string;
  description: string;
  telephone: string;
  address: BusinessAddress;
  hasMap: string;
  areaServed: unknown;
  currenciesAccepted: string;
  openingHours: readonly OpeningHours[];
  sameAs: readonly string[];
}) {
  const { type, id, address, openingHours, sameAs, ...rest } = options;
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': id,
    name: rest.name,
    legalName: rest.legalName,
    url: rest.url,
    image: rest.image,
    logo: rest.logo,
    description: rest.description,
    telephone: rest.telephone,
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
    hasMap: rest.hasMap,
    areaServed: rest.areaServed,
    currenciesAccepted: rest.currenciesAccepted,
    openingHoursSpecification: openingHours.map(({ days, opens, closes }) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [...days],
      opens,
      closes,
    })),
    sameAs: [...sameAs],
  };
}
