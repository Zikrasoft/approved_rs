import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translationIsCurrent } from '@podbor/i18n';
import { SUPPORTED_LOCALES } from './config';
import { content } from './content';
import { SECTIONS } from './sections';

const translated = SECTIONS.every(({ path, schema }) =>
  translationIsCurrent(readFileSync(path, 'utf-8'), schema),
);

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('returns every registered section', () => {
    expect(Object.keys(content(locale)).sort()).toEqual(
      SECTIONS.map(({ key }) => key).sort(),
    );
  });

  it.skipIf(!translated)(
    'loads a real translation for every section, never a silent ru fallback',
    () => {
      const russian = content('ru');
      Object.entries(content(locale)).forEach(([name, section]) => {
        const current = JSON.stringify(section);
        const ru = JSON.stringify(russian[name as keyof typeof russian]);
        if (locale === 'ru') {
          expect(current).toBe(ru);
        } else {
          expect(current, `${name} fell back to ru`).not.toBe(ru);
        }
      });
    },
  );

  it('has every faq group and the city expert answer', () => {
    const faq = content(locale).faq;
    for (const group of [
      'vehicle-sourcing',
      'vehicle-import',
      'vehicle-buyback',
      'vehicle-inspection',
      'general',
    ] as const) {
      expect(faq[group].length, group).toBeGreaterThan(0);
    }
    expect(faq.cityExpert.q).toBeTruthy();
  });

  it('has the home journey and trust cards', () => {
    const home = content(locale).home;
    expect(home.journey.length).toBe(4);
    expect(home.trustCards.length).toBe(3);
  });

  it('has every lead form field non-empty', () => {
    for (const [key, value] of Object.entries(content(locale).leadForm)) {
      expect(value, key).toBeTruthy();
    }
  });

  it('has every sourcing promo banner', () => {
    expect(content(locale).promoBanners.sourcing.length).toBe(10);
  });

  it('has every line the capture dialog sends', () => {
    for (const line of Object.values(content(locale).captureBot)) {
      expect(line.trim()).not.toBe('');
    }
  });
});

describe('content ru faq', () => {
  it('returns the authored counts', () => {
    const faq = content('ru').faq;
    expect(faq['vehicle-sourcing'].length).toBe(6);
    expect(faq['vehicle-import'].length).toBe(4);
    expect(faq['vehicle-buyback'].length).toBe(5);
    expect(faq['vehicle-inspection'].length).toBe(4);
    expect(faq.general.length).toBe(4);
  });
});
