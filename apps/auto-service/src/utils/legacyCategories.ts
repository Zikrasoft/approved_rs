import type { Redirect } from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from '../i18n/config.ts';
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

export const legacyShopRedirects = (): Redirect[] =>
  SUPPORTED_LOCALES.flatMap((locale) => [
    ...['cart', 'checkout'].flatMap((page) =>
      [`/${locale}/shop/${page}`, `/${locale}/shop/${page}/`].map((source) => ({
        source,
        destination: PathBuilder.partsCart(locale),
        permanent: true,
      })),
    ),
    ...[`/${locale}/shop/:path*`, `/${locale}/shop/:path+/`].map((source) => ({
      source,
      destination: PathBuilder.parts(locale),
      permanent: true,
    })),
  ]);

export const categoryFirstPageRedirects = (): Redirect[] =>
  SUPPORTED_LOCALES.flatMap((locale) => {
    const listing = PathBuilder.partsCategory(locale, ':slug');
    return [`${listing}1`, `${listing}1/`].map((source) => ({
      source,
      destination: listing,
      permanent: true,
    }));
  });

export const categoryCaseRedirects = (): Redirect[] =>
  SUPPORTED_LOCALES.flatMap((locale) => {
    const listing = PathBuilder.partsCategory(locale, ':slug([^/]*[A-Z][^/]*)');
    return [listing.slice(0, -1), listing].map((source) => ({
      source,
      destination: `${PathBuilder.partsSearch(locale)}?category=:slug`,
      permanent: true,
    }));
  });

export const lowercasedCategoryPath = (pathname: string): string | null =>
  pathname !== pathname.toLowerCase() &&
  SUPPORTED_LOCALES.some((locale) =>
    pathname.startsWith(PathBuilder.partsCategory(locale, '').slice(0, -1)),
  )
    ? pathname.toLowerCase()
    : null;

export const bmwPageRedirects = (): Redirect[] =>
  [
    ...SUPPORTED_LOCALES.map((locale) => [`/${locale}/bmw`, locale] as const),
    ['/bmw', PRIMARY_LOCALE] as const,
  ].flatMap(([path, locale]) =>
    [path, `${path}/`].map((source) => ({
      source,
      destination: PathBuilder.carsMake(locale, 'bmw'),
      permanent: true,
    })),
  );

export const siteRedirects = (): Redirect[] => [
  ...bmwPageRedirects(),
  ...legacyCategoryRedirects(),
  ...legacyShopRedirects(),
  ...categoryFirstPageRedirects(),
];
