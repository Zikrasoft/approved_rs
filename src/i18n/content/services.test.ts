import { describe, it, expect } from 'vitest';
import { getServicesContent } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getServicesContent', () => {
  it('every locale produces all top-level sections', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const s = getServicesContent(locale);
      expect(s.autopodbor.stepsFor('X').length).toBe(5);
      expect(s.autopodbor.deliveryDestinations.length).toBe(9);
      expect(s.proverka.steps.length).toBe(5);
      expect(s.avtoservisBelgrade.whatWeDo.length).toBe(5);
      expect(Object.keys(s.caseChrome.serviceBadges).length).toBe(4);
    }
  });

  it('template functions interpolate their argument', () => {
    expect(getServicesContent('en').autopodbor.descriptionFor('__LOC__')).toContain('__LOC__');
    expect(getServicesContent('sr').cityAutopodbor.whyCityHeadingFor('__CITY__')).toContain('__CITY__');
  });

  it('en and sr differ from ru', () => {
    expect(getServicesContent('en').autopodbor.title).not.toBe(getServicesContent('ru').autopodbor.title);
    expect(getServicesContent('sr').vykup.title).not.toBe(getServicesContent('ru').vykup.title);
  });
});
