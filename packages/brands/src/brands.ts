export type BrandKey = 'approved' | 'carlab' | 'details';

export interface Brand {
  key: BrandKey;
  domain: string;
  url: string;
  name: string;
  legalName: string;
  captureBot: string;
}

export const APPROVED = {
  key: 'approved',
  domain: 'approved.rs',
  url: 'https://approved.rs',
  name: 'Approved.rs',
  legalName: 'Approved.rs',
  captureBot: 'ApprovedRsBot',
} as const satisfies Brand;

export const CARLAB = {
  key: 'carlab',
  domain: 'carlab.rs',
  url: 'https://carlab.rs',
  name: 'CarLab',
  legalName: 'CarLab auto service',
  captureBot: 'CarLabRsBot',
} as const satisfies Brand;

export const DETAILS = {
  key: 'details',
  domain: 'details.rs',
  url: 'https://details.rs',
  name: 'Details',
  legalName: 'Details',
  captureBot: 'DetailsRsBot',
} as const satisfies Brand;

// TODO: postalCode is left out until the owner confirms it — Zvezdara spans several.
export const WORKSHOP_ADDRESS = {
  street: 'Jovana Ćirilova 23a',
  district: 'Zvezdara',
  city: 'Beograd',
  country: 'RS',
  lat: 44.8054581,
  lon: 20.4858424,
  googleMapsCid: '4988774890072933706',
} as const;

export const BRAND_LOCALES = ['ru', 'sr', 'en'] as const;

export type BrandLocale = (typeof BRAND_LOCALES)[number];

export function isBrandLocale(value: string): value is BrandLocale {
  return (BRAND_LOCALES as readonly string[]).includes(value);
}

export function brandLocale(locale: string): BrandLocale {
  return isBrandLocale(locale) ? locale : 'en';
}
