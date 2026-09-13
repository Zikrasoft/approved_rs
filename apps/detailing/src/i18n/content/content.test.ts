import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { getSiteContent } from './site';
import { getHomeContent } from './home';
import { getServicesContent } from './services';
import { getPagesContent } from './pages';
import { SERVICE_SLUGS } from '@/utils/services';
import { OPENING_HOURS } from '@/utils/constants';

const LAST_OPEN_DAY_LABEL = { ru: 'Сб', sr: 'Sub', en: 'Sat' };

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('loads and validates every section', () => {
    expect(() => getSiteContent(locale)).not.toThrow();
    expect(() => getHomeContent(locale)).not.toThrow();
    expect(() => getServicesContent(locale)).not.toThrow();
    expect(() => getPagesContent(locale)).not.toThrow();
  });

  it('loads a real translation for every section, never a silent ru fallback', () => {
    const sections = {
      site: getSiteContent,
      home: getHomeContent,
      services: getServicesContent,
      pages: getPagesContent,
    };
    Object.entries(sections).forEach(([name, load]) => {
      const current = JSON.stringify(load(locale));
      const russian = JSON.stringify(load('ru'));
      if (locale === 'ru') {
        expect(current).toBe(russian);
      } else {
        expect(current, `${name} fell back to ru`).not.toBe(russian);
      }
    });
  });

  it('has no Cyrillic left in a Latin-script locale', () => {
    if (locale === 'ru') return;
    const all = [
      JSON.stringify(getSiteContent(locale)),
      JSON.stringify(getHomeContent(locale)),
      JSON.stringify(getServicesContent(locale)),
      JSON.stringify(getPagesContent(locale)),
    ].join('');
    expect(all).not.toMatch(/[а-яА-ЯёЁ]/);
  });

  it('covers every service slug with copy', () => {
    const services = getServicesContent(locale);
    SERVICE_SLUGS.forEach((slug) => {
      expect(services[slug].name.trim().length).toBeGreaterThan(0);
      expect(services[slug].metaTitle.trim().length).toBeGreaterThan(0);
      expect(services[slug].includes.length).toBeGreaterThan(0);
    });
  });

  it('keeps meta descriptions inside the length search engines actually show', () => {
    const home = getHomeContent(locale);
    const pages = getPagesContent(locale);
    const descriptions = [
      home.meta.description,
      pages.works.metaDescription,
      pages.contact.metaDescription,
      ...SERVICE_SLUGS.map(
        (slug) => getServicesContent(locale)[slug].metaDescription,
      ),
    ];
    descriptions.forEach((description) => {
      expect(description.length).toBeGreaterThan(70);
      expect(description.length).toBeLessThanOrEqual(200);
    });
  });

  it('states the same opening hours the JSON-LD does', () => {
    const hours = getSiteContent(locale).footer.hours;
    const [, opens, closes] =
      hours.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/) ?? [];
    expect(opens).toBe(OPENING_HOURS.opens);
    expect(closes).toBe(OPENING_HOURS.closes);
    expect(OPENING_HOURS.days.at(-1)).toBe('Saturday');
    expect(hours).toContain(LAST_OPEN_DAY_LABEL[locale]);
  });

  it('offers exactly one pricing tier per headline service group', () => {
    expect(getHomeContent(locale).prices.plans).toHaveLength(3);
  });
});
