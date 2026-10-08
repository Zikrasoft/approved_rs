import { describe, it, expect } from 'vitest';
import { getPages } from './pages';
import { SITE_NAME } from '@/utils/constants';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getPages', () => {
  it('returns all sections for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const p = getPages(locale);
      expect(p.contacts.steps.length).toBe(3);
      expect(p.privacy.sections.length).toBe(4);
      expect(p.thanks.heading).toBeTruthy();
      expect(p.casesVehicleSourcing.metaTitle).toBeTruthy();
      expect(p.partners.heading).toBeTruthy();
      expect(p.partners.carlabDescription).toBeTruthy();
      expect(p.partners.detailsDescription).toBeTruthy();
    }
  });

  it('privacy.metaDescription interpolates the site name in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getPages(locale).privacy.metaDescription(SITE_NAME)).toContain(
        SITE_NAME,
      );
    }
  });

  it('en, sr, es and de differ from ru', () => {
    expect(getPages('en').contacts.heroTitle).not.toBe(
      getPages('ru').contacts.heroTitle,
    );
    expect(getPages('sr').contacts.heroTitle).not.toBe(
      getPages('ru').contacts.heroTitle,
    );
    expect(getPages('es').contacts.heroTitle).not.toBe(
      getPages('ru').contacts.heroTitle,
    );
    expect(getPages('de').contacts.heroTitle).not.toBe(
      getPages('ru').contacts.heroTitle,
    );
  });
});
