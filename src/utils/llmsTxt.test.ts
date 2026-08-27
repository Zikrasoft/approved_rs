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

  it('links directly to the auto-service and detailing service pages, not just their case listings', async () => {
    const body = await generateLlmsTxt('ru');
    expect(body).toContain('/ru/auto-service-belgrade/)');
    expect(body).toContain('/ru/detailing-belgrade/)');
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

  it('en and sr produce different section headings than ru (real translation, not copied)', async () => {
    const ru = await generateLlmsTxt('ru');
    const en = await generateLlmsTxt('en');
    expect(en).toContain('## Car Import');
    expect(ru).not.toContain('## Car Import');
  });
});
