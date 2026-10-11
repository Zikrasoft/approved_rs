export const SOURCE_LOCALE = 'ru';

export type SourceLocale = typeof SOURCE_LOCALE;

const NATIVE_LOCALE_NAMES: Readonly<Record<string, string>> = {
  ru: 'Русский',
  en: 'English',
  sr: 'Srpski',
  es: 'Español',
  de: 'Deutsch',
};

export interface PageHeadInput {
  title: string;
  description: string;
  ogImage?: string;
}

export interface LocaleSetOptions<L extends string, P extends L> {
  locales: readonly L[];
  primaryLocale: P;
  ogLocale: Readonly<Record<L, string>>;
  ogSuffix: Readonly<Record<L, string>>;
}

export function createLocaleSet<L extends string, P extends L>({
  locales,
  primaryLocale,
  ogLocale,
  ogSuffix,
}: LocaleSetOptions<L, P>) {
  if (locales.length === 0) {
    throw new Error('[i18n] locales must not be empty');
  }
  if (!locales.includes(primaryLocale)) {
    throw new Error(
      `[i18n] primaryLocale "${primaryLocale}" is not in the locale list`,
    );
  }
  if (!(locales as readonly string[]).includes(SOURCE_LOCALE)) {
    throw new Error(
      `[i18n] SOURCE_LOCALE "${SOURCE_LOCALE}" is not in the locale list`,
    );
  }

  const maps = { ogLocale, ogSuffix, NATIVE_LOCALE_NAMES };
  for (const [name, map] of Object.entries(maps)) {
    const missing = locales.filter((l) => !Object.hasOwn(map, l));
    if (missing.length) {
      throw new Error(`[i18n] ${name} has no entry for ${missing.join(', ')}`);
    }
  }

  const translatable = locales.filter(
    (l): l is Exclude<L, SourceLocale> => l !== SOURCE_LOCALE,
  );

  const alternateLinks = (
    siteUrl: string,
    pathname: string,
  ): { hreflang: string; href: string }[] => {
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments.slice(1).join('/');
    const suffix = rest ? `/${rest}/` : '/';

    const links = locales.map((locale) => ({
      hreflang: locale as string,
      href: `${siteUrl}/${locale}${suffix}`,
    }));
    links.push({
      hreflang: 'x-default',
      href: `${siteUrl}/${primaryLocale}${suffix}`,
    });
    return links;
  };

  const isLocale = (value: string): value is L =>
    (locales as readonly string[]).includes(value);

  const localeNames = Object.fromEntries(
    locales.map((locale) => [locale, NATIVE_LOCALE_NAMES[locale]]),
  ) as Readonly<Record<L, string>>;

  return {
    SUPPORTED_LOCALES: locales,
    LOCALE_NAME: localeNames,
    PRIMARY_LOCALE: primaryLocale,
    TRANSLATABLE_LOCALES: translatable,
    isLocale,

    getLocale(currentLocale: string | undefined): L {
      return currentLocale && isLocale(currentLocale)
        ? currentLocale
        : primaryLocale;
    },

    localeFrom(pathname: string): L {
      const first = pathname.split('/').filter(Boolean)[0];
      return first && isLocale(first) ? first : primaryLocale;
    },

    detectLocale(
      acceptLanguage: string | null,
      cookieValue: string | undefined,
    ): L {
      if (cookieValue && isLocale(cookieValue)) return cookieValue;
      if (!acceptLanguage) return primaryLocale;

      const ranked = acceptLanguage
        .split(',')
        .map((part) => {
          const [tag, qPart] = part.trim().split(';q=');
          return {
            primary: tag.trim().toLowerCase().split('-')[0],
            q: qPart ? Number(qPart) || 0 : 1,
          };
        })
        .filter(({ q }) => q > 0)
        .sort((a, b) => b.q - a.q);

      for (const { primary } of ranked) {
        const match = locales.find((l) => l === primary);
        if (match) return match;
      }
      return primaryLocale;
    },

    createPageHead(siteUrl: string) {
      return (
        locale: L,
        pathname: string,
        { title, description, ogImage }: PageHeadInput,
      ) => {
        const path = pathname === '/' ? `/${locale}/` : pathname;
        return {
          title,
          description,
          canonical: new URL(path, siteUrl).href,
          alternates: alternateLinks(siteUrl, path),
          ogLocale: ogLocale[locale],
          ogImage:
            ogImage ?? new URL(`/og${ogSuffix[locale]}.png`, siteUrl).href,
        };
      };
    },
  };
}

export type LocaleSet<L extends string, P extends L> = ReturnType<
  typeof createLocaleSet<L, P>
>;
