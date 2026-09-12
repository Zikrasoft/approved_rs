import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { getSiteContent } from './site';
import { getHomeContent } from './home';
import { getServicesContent } from './services';
import { getPagesContent } from './pages';
import { getShopContent } from './shop';
import { SERVICE_SLUGS } from '@/utils/services';

const SECTIONS = {
  site: getSiteContent,
  home: getHomeContent,
  services: getServicesContent,
  pages: getPagesContent,
  shop: getShopContent,
};

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('loads and validates every section', () => {
    Object.values(SECTIONS).forEach((load) => {
      expect(() => load(locale)).not.toThrow();
    });
  });

  it('loads a real translation for every section, never a silent ru fallback', () => {
    Object.entries(SECTIONS).forEach(([name, load]) => {
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
    const all = Object.values(SECTIONS)
      .map((load) => JSON.stringify(load(locale)))
      .join('');
    expect(all).not.toMatch(/[а-яА-ЯёЁ]/);
  });

  it('covers every service slug with copy', () => {
    const services = getServicesContent(locale);
    SERVICE_SLUGS.forEach((slug) => {
      expect(services[slug].name.trim().length).toBeGreaterThan(0);
      expect(services[slug].metaTitle.trim().length).toBeGreaterThan(0);
      expect(services[slug].includes.length).toBeGreaterThan(0);
      expect(services[slug].signs.length).toBeGreaterThan(0);
    });
  });

  it('keeps meta descriptions inside the length search engines actually show', () => {
    const services = getServicesContent(locale);
    const descriptions = [
      getHomeContent(locale).meta.description,
      getShopContent(locale).metaDescription,
      getPagesContent(locale).works.metaDescription,
      getPagesContent(locale).contact.metaDescription,
      ...SERVICE_SLUGS.map((slug) => services[slug].metaDescription),
    ];
    descriptions.forEach((description) => {
      expect(description.length).toBeGreaterThan(70);
      expect(description.length).toBeLessThanOrEqual(200);
    });
  });
});
