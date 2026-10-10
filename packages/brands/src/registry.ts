import {
  APPROVED,
  CARLAB,
  DETAILS,
  type Brand,
  type BrandKey,
} from './brands.ts';

export const BRANDS = {
  approved: APPROVED,
  carlab: CARLAB,
  details: DETAILS,
} as const satisfies Record<BrandKey, Brand>;

export const BRAND_SITES = {
  approved: APPROVED.url,
  carlab: CARLAB.url,
  details: DETAILS.url,
} as const satisfies Record<BrandKey, string>;
