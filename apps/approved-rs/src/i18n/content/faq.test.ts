import { describe, it, expect } from 'vitest';
import { content } from '@/i18n/content';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('content().faq', () => {
  it('returns the authored ru counts', () => {
    const faq = content('ru').faq;
    expect(faq['vehicle-sourcing'].length).toBe(6);
    expect(faq['vehicle-import'].length).toBe(4);
    expect(faq['vehicle-buyback'].length).toBe(5);
    expect(faq['vehicle-inspection'].length).toBe(4);
    expect(faq.general.length).toBe(4);
    expect(faq.cityExpert.q).toBeTruthy();
  });

  it('returns all 7 groups plus cityExpert for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const faq = content(locale).faq;
      expect(faq['vehicle-sourcing'].length).toBeGreaterThan(0);
      expect(faq['vehicle-import'].length).toBeGreaterThan(0);
      expect(faq['vehicle-buyback'].length).toBeGreaterThan(0);
      expect(faq['vehicle-inspection'].length).toBeGreaterThan(0);
      expect(faq.general.length).toBeGreaterThan(0);
      expect(faq.cityExpert.q).toBeTruthy();
    }
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(content('en').faq['vehicle-sourcing'][0].q).not.toBe(
      content('ru').faq['vehicle-sourcing'][0].q,
    );
    expect(content('sr').faq['vehicle-sourcing'][0].q).not.toBe(
      content('ru').faq['vehicle-sourcing'][0].q,
    );
    expect(content('es').faq['vehicle-sourcing'][0].q).not.toBe(
      content('ru').faq['vehicle-sourcing'][0].q,
    );
    expect(content('de').faq['vehicle-sourcing'][0].q).not.toBe(
      content('ru').faq['vehicle-sourcing'][0].q,
    );
    expect(content('en').faq['vehicle-import'][0].q).not.toBe(
      content('ru').faq['vehicle-import'][0].q,
    );
    expect(content('sr').faq['vehicle-import'][0].q).not.toBe(
      content('ru').faq['vehicle-import'][0].q,
    );
    expect(content('es').faq['vehicle-import'][0].q).not.toBe(
      content('ru').faq['vehicle-import'][0].q,
    );
    expect(content('de').faq['vehicle-import'][0].q).not.toBe(
      content('ru').faq['vehicle-import'][0].q,
    );
  });
});
