import { describe, it, expect, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([
    {
      id: 'bmw-x5',
      body: 'Телом на русском.',
      data: {
        title: 'BMW X5 — плёнка PPF',
        published: true,
        date: new Date('2026-01-01'),
        translations: { sr: { title: 'BMW X5 — PPF folija', body: 'Telo.' } },
      },
    },
    {
      id: 'draft',
      body: '',
      data: {
        title: 'Черновик',
        published: false,
        date: new Date('2026-02-01'),
      },
    },
  ]),
}));

const { generateLlmsTxt } = await import('./llmsTxt');
const { SUPPORTED_LOCALES } = await import('@/i18n/config');
const { SERVICE_SLUGS } = await import('./services');
const { getSiteContent } = await import('@/i18n/content/site');
const { STUDIO_ADDRESS } = await import('./constants');

describe('generateLlmsTxt', () => {
  it('lists every service for every locale', async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const body = await generateLlmsTxt(locale);
      for (const slug of SERVICE_SLUGS)
        expect(body).toContain(`/${locale}/services/${slug}/)`);
    }
  });

  it('links each published work by its localized title, leaving drafts out', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain(
      '- [BMW X5 — PPF folija](https://details.rs/sr/works/bmw-x5/)',
    );
    expect(body).not.toContain('Черновик');
  });

  it('falls back to the Russian title when a locale has no translation', async () => {
    expect(await generateLlmsTxt('en')).toContain('[BMW X5 — плёнка PPF]');
  });

  it('"other languages" links to the other locales, not the current one', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain('https://details.rs/ru/llms.txt');
    expect(body).toContain('https://details.rs/en/llms.txt');
    expect(body).not.toContain('https://details.rs/sr/llms.txt');
  });

  it('names the brand in the top heading', async () => {
    expect((await generateLlmsTxt('sr')).startsWith('# Details')).toBe(true);
  });

  it('carries the studio address and opening hours as key facts', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain(STUDIO_ADDRESS.street);
    expect(body).toContain(getSiteContent('sr').footer.hours);
  });
});
