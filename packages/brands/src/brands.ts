export type BrandKey = 'approved' | 'carlab' | 'details';

export interface Brand {
  key: BrandKey;
  domain: string;
  url: string;
  name: string;
  legalName: string;
}

export const APPROVED = {
  key: 'approved',
  domain: 'approved.rs',
  url: 'https://approved.rs',
  name: 'Approved.rs',
  legalName: 'Approved.rs',
} as const satisfies Brand;

export const CARLAB = {
  key: 'carlab',
  domain: 'carlab.rs',
  url: 'https://carlab.rs',
  name: 'CarLab',
  legalName: 'CarLab auto service',
} as const satisfies Brand;

export const DETAILS = {
  key: 'details',
  domain: 'details.rs',
  url: 'https://details.rs',
  name: 'Details',
  legalName: 'Details',
} as const satisfies Brand;

export const BRAND_LOCALES = ['ru', 'sr', 'en'] as const;

export type BrandLocale = (typeof BRAND_LOCALES)[number];

export function isBrandLocale(value: string): value is BrandLocale {
  return (BRAND_LOCALES as readonly string[]).includes(value);
}

export function brandLocale(locale: string): BrandLocale {
  return isBrandLocale(locale) ? locale : 'en';
}
