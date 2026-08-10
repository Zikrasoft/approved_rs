import { describe, it, expect } from 'vitest';
import { getFaq } from './faq';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getFaq', () => {
  it('returns all 6 groups plus cityExpert for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const faq = getFaq(locale);
      expect(faq.autopodbor.length).toBe(6);
      expect(faq.privoz.length).toBe(3);
      expect(faq.vykup.length).toBe(4);
      expect(faq.proverka.length).toBe(3);
      expect(faq.autoservice.length).toBe(2);
      expect(faq.general.length).toBe(2);
      expect(faq.cityExpert.q).toBeTruthy();
    }
  });

  it('en and sr contain different text than ru (real translations, not copies)', () => {
    expect(getFaq('en').autopodbor[0].q).not.toBe(getFaq('ru').autopodbor[0].q);
    expect(getFaq('sr').autopodbor[0].q).not.toBe(getFaq('ru').autopodbor[0].q);
    expect(getFaq('en').privoz[0].q).not.toBe(getFaq('ru').privoz[0].q);
    expect(getFaq('sr').privoz[0].q).not.toBe(getFaq('ru').privoz[0].q);
  });
});
