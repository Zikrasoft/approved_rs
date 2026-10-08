import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translationIsCurrent } from '@podbor/i18n';
import { content } from '@/i18n/content';
import { SECTIONS } from '@/i18n/sections';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SERVICE_SLUGS } from '@/utils/services';

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
      Object.entries(content(locale)).forEach(([name, section]) => {
        const current = JSON.stringify(section);
        const russian = JSON.stringify(
          content('ru')[name as keyof ReturnType<typeof content>],
        );
        if (locale === 'ru') {
          expect(current).toBe(russian);
        } else {
          expect(current, `${name} fell back to ru`).not.toBe(russian);
        }
      });
    },
  );

  it.skipIf(!translated)(
    'has no Cyrillic left in a Latin-script locale',
    () => {
      if (locale === 'ru') return;
      const all = JSON.stringify(content(locale));
      expect(all).not.toMatch(/[а-яА-ЯёЁ]/);
    },
  );

  it('covers every service slug with copy', () => {
    const services = content(locale).services;
    SERVICE_SLUGS.forEach((slug) => {
      expect(services[slug].name.trim().length).toBeGreaterThan(0);
      expect(services[slug].metaTitle.trim().length).toBeGreaterThan(0);
      expect(services[slug].includes.length).toBeGreaterThan(0);
      expect(services[slug].signs.length).toBeGreaterThan(0);
    });
  });

  it('keeps meta descriptions inside the length search engines actually show', () => {
    const services = content(locale).services;
    const descriptions = [
      content(locale).home.meta.description,
      content(locale).shop.metaDescription,
      content(locale).pages.works.metaDescription,
      content(locale).pages.contact.metaDescription,
      ...SERVICE_SLUGS.map((slug) => services[slug].metaDescription),
      ...Object.values(content(locale).shop.types).map(
        (type) => type.metaDescription,
      ),
    ];
    descriptions.forEach((description) => {
      expect(description.length).toBeGreaterThan(70);
      expect(description.length).toBeLessThanOrEqual(200);
    });
  });
});
