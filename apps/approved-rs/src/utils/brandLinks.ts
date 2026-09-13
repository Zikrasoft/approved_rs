import { BRAND_SITES, brandLocale, type BrandKey } from '@podbor/brands';
import type { Locale } from '@/i18n/config';

export const brandHome = (brand: BrandKey, locale: Locale): string =>
  `${BRAND_SITES[brand]}/${brandLocale(locale)}/`;
