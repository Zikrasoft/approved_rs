import { describe, it, expect, vi } from 'vitest';
import { mapPlaceUrl } from '@podbor/site-kit';

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
const { content } = await import('@/i18n/content');
const { GARAGE_ADDRESS } = await import('./constants');

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
      '- [BMW X5 — PPF folija](https://carlab.rs/sr/works/bmw-x5/)',
    );
    expect(body).not.toContain('Черновик');
  });

  it('falls back to the Russian title when a locale has no translation', async () => {
    expect(await generateLlmsTxt('en')).toContain('[BMW X5 — плёнка PPF]');
  });

  it('"other languages" links to the other locales, not the current one', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain('https://carlab.rs/ru/llms.txt');
    expect(body).toContain('https://carlab.rs/en/llms.txt');
    expect(body).not.toContain('https://carlab.rs/sr/llms.txt');
  });

  it('names the brand in the top heading', async () => {
    expect((await generateLlmsTxt('sr')).startsWith('# CarLab')).toBe(true);
  });

  it('carries the garage address and opening hours as key facts', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain(GARAGE_ADDRESS.street);
    expect(body).toContain(mapPlaceUrl(GARAGE_ADDRESS.googleMapsCid));
    expect(body).toContain(content('sr').site.footer.hours);
  });

  it('lists the Category pages and the Make hubs', async () => {
    const answers: Record<string, unknown> = {
      '/store/categories': {
        categories: [
          {
            id: 'category_oil',
            slug: 'engine-oil',
            name: 'Моторное масло',
            text: 'Масло для двигателя.\n\nВторой абзац.',
            translations: {
              sr: { name: 'Motorno ulje', text: 'Ulje za motor.' },
            },
            fields: [],
          },
        ],
      },
      '/store/vehicles': {
        vehicles: [
          {
            id: 'veh_1',
            power_kw: 140,
            drive: 'rwd',
            market: 'EU',
            year_from: 2015,
            year_to: 2019,
            steering: 'left',
            model: {
              slug: 'f30-320d',
              name: '320d',
              chassis: {
                code: 'F30',
                body_style: 'sedan',
                series: {
                  name: '3 серия',
                  translations: null,
                  make: { slug: 'bmw', name: 'BMW' },
                },
              },
            },
            engine: {
              code: 'B47D20O0',
              family: 'B47',
              fuel: 'diesel',
              displacement_cc: 1995,
            },
            identifiers: [],
          },
        ],
      },
    };
    vi.stubEnv('MEDUSA_BACKEND_URL', 'http://localhost:9009');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          answers[new URL(url).pathname] ?? {
            pages: [],
            fitments: [],
            count: 0,
            offset: 0,
            limit: 1000,
          },
      })),
    );

    const body = await generateLlmsTxt('sr').finally(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    expect(body).toContain(
      '[Motorno ulje](https://carlab.rs/sr/parts/c/engine-oil/) — Ulje za motor.',
    );
    expect(body).toContain('[BMW](https://carlab.rs/sr/parts/bmw/)');
  });

  it('links the BMW landing page', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain(`](https://carlab.rs/sr/bmw/)`);
  });

  it('describes the parts catalogue on the parts index link', async () => {
    expect(await generateLlmsTxt('ru')).toContain(
      '](https://carlab.rs/ru/parts/) — Каталог запчастей CarLab: у каждого номера детали своя страница с аналогами, ценой и наличием у поставщика. Запчасти с ценой кладут в корзину и заказывают с самовывозом и оплатой наличными на СТО',
    );
  });

  it('links the about page', async () => {
    expect(await generateLlmsTxt('ru')).toContain(
      '[О проекте](https://carlab.rs/ru/about/)',
    );
  });

  it('ends with the studio credit, without tracking parameters', async () => {
    expect((await generateLlmsTxt('ru')).trimEnd()).toMatch(
      /\nСайт сделан в студии Zikrasoft: https:\/\/zikrasoft\.com\/$/,
    );
  });
});
