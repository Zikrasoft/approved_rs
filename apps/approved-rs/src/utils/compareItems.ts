import { getActiveCountries } from './geo';
import { buildLocation } from './seo';
import { PathBuilder } from './paths';
import type { CountryScopedServiceSlug } from './labels';
import type { CountryNote } from '@/i18n/content/services';
import type { Locale } from '@/i18n/config';

export interface CompareItem {
  name: string;
  href: string;
  linkLabel: string;
  note: CountryNote;
}

export function compareItemsFor(
  locale: Locale,
  service: CountryScopedServiceSlug,
  noteFor: (countryCode: string) => CountryNote | undefined,
  linkLabelFor: (location: string) => string,
): CompareItem[] {
  return getActiveCountries().flatMap((country) => {
    const note = noteFor(country.code);
    return note
      ? [
          {
            name: country[locale].name,
            href: PathBuilder.service(locale, service, country.code),
            linkLabel: linkLabelFor(buildLocation(locale, country)),
            note,
          },
        ]
      : [];
  });
}
