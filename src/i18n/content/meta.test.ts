import { describe, it, expect } from 'vitest';
import { getMetaTemplates } from './meta';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getMetaTemplates', () => {
  it('interpolates the location string into title and description for every locale/service', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const templates = getMetaTemplates(locale);
      for (const service of ['vehicle-sourcing', 'vehicle-buyback', 'vehicle-inspection'] as const) {
        const result = templates[service]('__LOC__');
        expect(result.title).toContain('__LOC__');
        expect(result.description).toContain('__LOC__');
      }
    }
  });

  it('en, sr, es and de produce different text than ru', () => {
    expect(getMetaTemplates('en')['vehicle-sourcing']('X').title).not.toBe(getMetaTemplates('ru')['vehicle-sourcing']('X').title);
    expect(getMetaTemplates('sr')['vehicle-sourcing']('X').title).not.toBe(getMetaTemplates('ru')['vehicle-sourcing']('X').title);
    expect(getMetaTemplates('es')['vehicle-sourcing']('X').title).not.toBe(getMetaTemplates('ru')['vehicle-sourcing']('X').title);
    expect(getMetaTemplates('de')['vehicle-sourcing']('X').title).not.toBe(getMetaTemplates('ru')['vehicle-sourcing']('X').title);
  });
});
