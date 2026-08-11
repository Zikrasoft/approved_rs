import { describe, it, expect } from 'vitest';
import { getFaq } from './faq';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getFaq', () => {
  it('returns all 6 groups plus cityExpert for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const faq = getFaq(locale);
      expect(faq['vehicle-sourcing'].length).toBe(6);
      expect(faq['vehicle-import'].length).toBe(2);
      expect(faq['vehicle-buyback'].length).toBe(4);
      expect(faq['vehicle-inspection'].length).toBe(3);
      expect(faq.autoservice.length).toBe(2);
      expect(faq.general.length).toBe(2);
      expect(faq.cityExpert.q).toBeTruthy();
    }
  });

  it('en and sr contain different text than ru (real translations, not copies)', () => {
    expect(getFaq('en')['vehicle-sourcing'][0].q).not.toBe(getFaq('ru')['vehicle-sourcing'][0].q);
    expect(getFaq('sr')['vehicle-sourcing'][0].q).not.toBe(getFaq('ru')['vehicle-sourcing'][0].q);
    expect(getFaq('en')['vehicle-import'][0].q).not.toBe(getFaq('ru')['vehicle-import'][0].q);
    expect(getFaq('sr')['vehicle-import'][0].q).not.toBe(getFaq('ru')['vehicle-import'][0].q);
  });
});
