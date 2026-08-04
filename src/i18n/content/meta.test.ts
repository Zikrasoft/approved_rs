import { describe, it, expect } from 'vitest';
import { getMetaTemplates } from './meta';

describe('getMetaTemplates', () => {
  it('interpolates the location string into title and description for every locale/service', () => {
    for (const locale of ['ru', 'en', 'sr'] as const) {
      const templates = getMetaTemplates(locale);
      for (const service of ['autopodbor', 'vykup', 'proverka'] as const) {
        const result = templates[service]('__LOC__');
        expect(result.title).toContain('__LOC__');
        expect(result.description).toContain('__LOC__');
      }
    }
  });

  it('en and sr produce different text than ru', () => {
    expect(getMetaTemplates('en').autopodbor('X').title).not.toBe(getMetaTemplates('ru').autopodbor('X').title);
    expect(getMetaTemplates('sr').autopodbor('X').title).not.toBe(getMetaTemplates('ru').autopodbor('X').title);
  });
});
