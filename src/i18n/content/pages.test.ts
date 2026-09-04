import { describe, it, expect } from 'vitest';
import { getPagesContent } from './pages';
import { SITE_NAME } from '@/utils/constants';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getPagesContent', () => {
  it('returns all sections for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const p = getPagesContent(locale);
      expect(p.contacts.steps.length).toBe(3);
      expect(p.privacy.sections.length).toBe(4);
      expect(p.thanks.heading).toBeTruthy();
      expect(p.casesVehicleSourcing.metaTitle).toBeTruthy();
      expect(p.casesAutoService.metaTitle).toBeTruthy();
    }
  });

  it('privacy.metaDescription interpolates the site name', () => {
    expect(getPagesContent('ru').privacy.metaDescription(SITE_NAME)).toContain(SITE_NAME);
    expect(getPagesContent('en').privacy.metaDescription(SITE_NAME)).toContain(SITE_NAME);
    expect(getPagesContent('sr').privacy.metaDescription(SITE_NAME)).toContain(SITE_NAME);
  });

  it('en, sr, es and de differ from ru', () => {
    expect(getPagesContent('en').contacts.heroTitle).not.toBe(getPagesContent('ru').contacts.heroTitle);
    expect(getPagesContent('sr').contacts.heroTitle).not.toBe(getPagesContent('ru').contacts.heroTitle);
    expect(getPagesContent('es').contacts.heroTitle).not.toBe(getPagesContent('ru').contacts.heroTitle);
    expect(getPagesContent('de').contacts.heroTitle).not.toBe(getPagesContent('ru').contacts.heroTitle);
  });
});
