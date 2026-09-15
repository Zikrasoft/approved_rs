import { describe, it, expect, vi } from 'vitest';

// generateLlmsTxt pulls in casesQueries.ts, which imports getCollection from
// the virtual 'astro:content' module — only resolvable inside Astro's own
// build pipeline, not in this project's plain-Node vitest config. Mocked
// here (standard vitest technique for virtual modules) rather than pulling
// Astro's Vite plugin into the test config for one file.
vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([]),
}));

const { generateLlmsTxt } = await import('./llmsTxt');
const { SUPPORTED_LOCALES } = await import('@/i18n/config');
const { translationIsCurrent } = await import('@podbor/i18n');
const { dictionaryContentSchema } =
  await import('@/i18n/dictionaryContentSchema');
const dictionaryYaml = (await import('@/content/i18n/dictionary.yaml?raw'))
  .default;

// ru is hand-edited and CI translates on push; this assertion describes the
// state CI produces and stands down while a translation is still pending.
const translated = translationIsCurrent(
  dictionaryYaml,
  dictionaryContentSchema,
);

describe('generateLlmsTxt', () => {
  it('includes the hub and all 5 vehicle-import spokes for every locale', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const body = await generateLlmsTxt(locale);
      expect(body).toContain(`/${locale}/vehicle-import/)`);
      expect(body).toContain(`/${locale}/vehicle-import/eu/de/)`);
      expect(body).toContain(`/${locale}/vehicle-import/eu/es/)`);
      expect(body).toContain(`/${locale}/vehicle-import/eu/ch/)`);
      expect(body).toContain(`/${locale}/vehicle-import/eu/)`);
      expect(body).toContain(`/${locale}/vehicle-import/china/)`);
    }
  });

  it('includes the Portugal country entry (added after this file was first written)', async () => {
    const body = await generateLlmsTxt('ru');
    expect(body).toContain('/ru/vehicle-sourcing/pt/)');
  });

  it('"other languages" section links to the other 2 locales, not the current one', async () => {
    const body = await generateLlmsTxt('ru');
    expect(body).toContain('https://approved.rs/en/llms.txt');
    expect(body).toContain('https://approved.rs/sr/llms.txt');
    expect(body).not.toContain('https://approved.rs/ru/llms.txt');
  });

  it('starts with the site name heading and ends with a trailing newline', async () => {
    const body = await generateLlmsTxt('ru');
    expect(body.startsWith('# Approved.rs')).toBe(true);
    expect(body.endsWith('\n')).toBe(true);
  });

  it.skipIf(!translated)(
    'en headings are a real translation of the ru ones, not a copy',
    async () => {
      const ru = await generateLlmsTxt('ru');
      const en = await generateLlmsTxt('en');
      const headings = (body: string) =>
        body.split('\n').filter((line) => line.startsWith('## '));
      expect(headings(en)).toHaveLength(headings(ru).length);
      headings(en).forEach((heading, index) => {
        expect(heading).not.toBe(headings(ru)[index]);
      });
    },
  );
});
