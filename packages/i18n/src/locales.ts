export const SOURCE_LOCALE = 'ru';

export type SourceLocale = typeof SOURCE_LOCALE;

export interface LocaleSetOptions<L extends string, P extends L> {
  locales: readonly L[];
  primaryLocale: P;
}

export function createLocaleSet<L extends string, P extends L>({
  locales,
  primaryLocale,
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

  const translatable = locales.filter(
    (l): l is Exclude<L, SourceLocale> => l !== SOURCE_LOCALE,
  );

  const isLocale = (value: string): value is L =>
    (locales as readonly string[]).includes(value);

  return {
    SUPPORTED_LOCALES: locales,
    PRIMARY_LOCALE: primaryLocale,
    TRANSLATABLE_LOCALES: translatable,
    isLocale,

    getLocale(currentLocale: string | undefined): L {
      return currentLocale && isLocale(currentLocale)
        ? currentLocale
        : primaryLocale;
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

    getAlternateLinks(
      siteUrl: string,
      pathname: string,
    ): { hreflang: string; href: string }[] {
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
    },
  };
}

export type LocaleSet<L extends string, P extends L> = ReturnType<
  typeof createLocaleSet<L, P>
>;
