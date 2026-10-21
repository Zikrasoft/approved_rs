import type { Redirect } from '@podbor/site-kit/redirects';
import { SUPPORTED_LOCALES } from '../i18n/config.ts';
import { PathBuilder } from './paths.ts';

export const LEGACY_CATEGORY_TARGETS: Record<string, string> = {
  'maintenance-consumables': 'maintenance-consumables',
  brakes: 'brakes',
  suspension: 'suspension',
  'engine-parts': 'engine-parts',
  electrics: 'electrics',
  transmission: 'transmission',
  'body-parts': 'body-parts',
};

export const legacyCategoryRedirects = (): Redirect[] =>
  SUPPORTED_LOCALES.flatMap((locale) =>
    Object.entries(LEGACY_CATEGORY_TARGETS).flatMap(([legacy, slug]) =>
      [`/${locale}/parts/${legacy}`, `/${locale}/parts/${legacy}/`].map(
        (source) => ({
          source,
          destination: PathBuilder.partsCategory(locale, slug),
          permanent: true,
        }),
      ),
    ),
  );
