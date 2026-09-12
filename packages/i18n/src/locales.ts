export interface LocaleSetOptions<L extends string, D extends L> {
  locales: readonly L[];
  defaultLocale: D;
}

export function createLocaleSet<L extends string, D extends L>({
  locales,
  defaultLocale,
}: LocaleSetOptions<L, D>) {
  if (locales.length === 0) {
    throw new Error('[i18n] locales must not be empty');
  }
  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `[i18n] defaultLocale "${defaultLocale}" is not in the locale list`,
    );
  }

  const translatable = locales.filter(
    (l): l is Exclude<L, D> => l !== defaultLocale,
  );

  const isLocale = (value: string): value is L =>
    (locales as readonly string[]).includes(value);

  return {
    SUPPORTED_LOCALES: locales,
    DEFAULT_LOCALE: defaultLocale,
    TRANSLATABLE_LOCALES: translatable,
    isLocale,

    getLocale(currentLocale: string | undefined): L {
      return (currentLocale ?? defaultLocale) as L;
    },

    detectLocale(
      acceptLanguage: string | null,
      cookieValue: string | undefined,
    ): L {
      if (cookieValue && isLocale(cookieValue)) return cookieValue;
      if (!acceptLanguage) return defaultLocale;

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
      return defaultLocale;
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
        href: `${siteUrl}/${defaultLocale}${suffix}`,
      });
      return links;
    },
  };
}

export type LocaleSet<L extends string, D extends L> = ReturnType<
  typeof createLocaleSet<L, D>
>;
