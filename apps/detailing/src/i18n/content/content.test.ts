import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translationIsCurrent } from '@podbor/i18n';
import { content } from '@/i18n/content';
import { SECTIONS } from '@/i18n/sections';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SERVICE_SLUGS } from '@/utils/services';
import { OPENING_HOURS } from '@/utils/constants';

const LAST_OPEN_DAY_LABEL = { ru: 'Сб', sr: 'Sub', en: 'Sat' };

const translated = SECTIONS.every(({ path, schema }) =>
  translationIsCurrent(readFileSync(path, 'utf-8'), schema),
);

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('loads and validates every section', () => {
    expect(Object.keys(content(locale)).sort()).toEqual(
      SECTIONS.map(({ key }) => key).sort(),
    );
  });

  it.skipIf(!translated)(
    'loads a real translation for every section, never a silent ru fallback',
    () => {
      const { site, home, services, pages } = content(locale);
      const russian = content('ru');
      Object.entries({ site, home, services, pages }).forEach(
        ([name, section]) => {
          const current = JSON.stringify(section);
          const ru = JSON.stringify(russian[name as keyof typeof russian]);
          if (locale === 'ru') {
            expect(current).toBe(ru);
          } else {
            expect(current, `${name} fell back to ru`).not.toBe(ru);
          }
        },
      );
    },
  );

  it.skipIf(!translated)(
    'has no Cyrillic left in a Latin-script locale',
    () => {
      if (locale === 'ru') return;
      const { site, home, services, pages } = content(locale);
      expect(JSON.stringify([site, home, services, pages])).not.toMatch(
        /[а-яА-ЯёЁ]/,
      );
    },
  );

  it('covers every service slug with copy', () => {
    const { services } = content(locale);
    SERVICE_SLUGS.forEach((slug) => {
      expect(services[slug].name.trim().length).toBeGreaterThan(0);
      expect(services[slug].metaTitle.trim().length).toBeGreaterThan(0);
      expect(services[slug].includes.length).toBeGreaterThan(0);
    });
  });

  it('keeps meta descriptions inside the length search engines actually show', () => {
    const { home, pages, services } = content(locale);
    const descriptions = [
      home.meta.description,
      pages.works.metaDescription,
      pages.contact.metaDescription,
      ...SERVICE_SLUGS.map((slug) => services[slug].metaDescription),
    ];
    descriptions.forEach((description) => {
      expect(description.length).toBeGreaterThan(70);
      expect(description.length).toBeLessThanOrEqual(200);
    });
  });

  it('states the same opening hours the JSON-LD does', () => {
    const hours = content(locale).site.footer.hours;
    const [, opens, closes] =
      hours.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/) ?? [];
    expect(opens).toBe(OPENING_HOURS.opens);
    expect(closes).toBe(OPENING_HOURS.closes);
    expect(OPENING_HOURS.days.at(-1)).toBe('Saturday');
    expect(hours).toContain(LAST_OPEN_DAY_LABEL[locale]);
  });

  it('offers exactly one pricing tier per headline service group', () => {
    expect(content(locale).home.prices.plans).toHaveLength(3);
  });
});
