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

  const withBackend = async (
    shopOpen: string,
    locale: 'sr' | 'ru' = 'sr',
    extraVehicles: unknown[] = [],
    fitted: string[] = ['veh_1'],
  ) => {
    const numbers = ['HU816X', 'HU7020Z', 'HU6004X'];
    const answers: Record<string, unknown> = {
      '/store/part-pages': {
        pages: numbers.map((number) => ({
          id: `pi_${number}`,
          type: 'manufacturer-number',
          value: number,
          normalized_value: number,
          superseded: false,
          brand: { name: 'MANN-FILTER', slug: 'mann-filter' },
          images: [],
          part: {
            id: `part_${number}`,
            name: 'Масляный фильтр',
            translations: null,
            replaced_by: null,
            category_id: null,
            attributes: {},
          },
          equivalents: [],
          offers: [],
          supplier_data: {
            cross_references: [],
            applicability: [],
            images: [],
          },
        })),
        count: numbers.length,
        offset: 0,
        limit: 1000,
      },
      '/store/fitments': {
        fitments: fitted.flatMap((vehicle_id) =>
          numbers.map((number) => ({
            id: `fit_${vehicle_id}_${number}`,
            part_id: `part_${number}`,
            vehicle_id,
            quantity: 1,
            axle: null,
            side: null,
            production_from: null,
            production_to: null,
            gearbox: null,
            steering: null,
            note: null,
            translations: null,
          })),
        ),
        count: fitted.length * numbers.length,
        offset: 0,
        limit: 1000,
      },
      '/store/categories': {
        categories: [
          {
            id: 'category_oil',
            slug: 'engine-oil',
            name: 'Моторное масло',
            text: 'Масло для двигателя.\n\nВторой абзац.',
            translations: {
              sr: {
                name: 'Motorno ulje',
                text: 'Ulje za motor.',
                service_label: 'Zamena ulja',
              },
            },
            maintenance_kit: false,
            kit_rank: 0,
            service_label: 'Замена масла',
            service_price: 2500,
            service_note: null,
            installation_price: 1500,
            image: null,
            fields: [],
          },
        ],
      },
      '/store/vehicles': {
        vehicles: [
          {
            id: 'veh_1',
            slug: 'b47d20o0-140kw',
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
            requirements: [],
          },
          ...extraVehicles,
        ],
      },
    };
    (globalThis as { [key: symbol]: Map<string, unknown> | undefined })[
      Symbol.for('carlab.buildSnapshots')
    ]?.clear();
    vi.stubEnv('MEDUSA_BACKEND_URL', 'http://localhost:9009');
    vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
    vi.stubEnv('SHOP_OPEN', shopOpen);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          answers[new URL(url).pathname] ?? {
            pages: [],
            fitments: [],
            redirects: [],
            count: 0,
            offset: 0,
            limit: 1000,
          },
      })),
    );

    return generateLlmsTxt(locale).finally(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
  };

  it('lists the Category pages and the Make hubs', async () => {
    const body = await withBackend('true');

    expect(body).toContain(
      '[Motorno ulje](https://carlab.rs/sr/parts/c/engine-oil/) — Ulje za motor. Zamena ulja: 2.500 RSD',
    );
    expect(body).toContain('[BMW](https://carlab.rs/sr/parts/bmw/)');
  });

  it('links the page of every Make', async () => {
    expect(await withBackend('true', 'ru')).toContain(
      '[Все марки](https://carlab.rs/ru/parts/makes/)',
    );
  });

  it('leaves out a Make and a Model with too few Parts for a page', async () => {
    const body = await withBackend('true', 'sr', [], []);

    expect(body).not.toContain('https://carlab.rs/sr/parts/bmw/');
  });

  it('lists a Model page, and its Vehicle pages only when several of them have one', async () => {
    const alone = await withBackend('true');
    expect(alone).toContain(
      '[BMW 3 серия F30 320d](https://carlab.rs/sr/parts/bmw/f30-320d/)',
    );
    expect(alone).not.toContain('/m/');

    const several = await withBackend(
      'true',
      'sr',
      [
        {
          id: 'veh_2',
          slug: 'b47d20o0-110kw',
          power_kw: 110,
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
          requirements: [],
        },
        {
          id: 'veh_3',
          slug: 'b47d20o0-100kw',
          power_kw: 100,
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
          requirements: [],
        },
      ],
      ['veh_1', 'veh_2'],
    );
    expect(several).toContain(
      '[BMW 3 серия F30 320d](https://carlab.rs/sr/parts/bmw/f30-320d/)',
    );
    expect(several).toContain(
      '[BMW 3 серия F30 320d, B47D20O0, 140 kW, 2015–2019](https://carlab.rs/sr/parts/bmw/f30-320d/m/b47d20o0-140kw/)',
    );
    expect(several).toContain(
      '](https://carlab.rs/sr/parts/bmw/f30-320d/m/b47d20o0-110kw/)',
    );
    expect(several).not.toContain('/m/b47d20o0-100kw/');
  });

  it('names the installation price of a Category beside its add-on service', async () => {
    const body = await withBackend('true', 'ru');

    expect(body).toContain(
      'Масло для двигателя. Замена масла: 2\u00a0500 RSD. Установка в сервисе CarLab: 1\u00a0500 RSD',
    );
  });

  it('names no price and orders parts by inquiry, priced by staff, while the shop is closed', async () => {
    const body = await withBackend('false');

    expect(body).toContain(
      '[Motorno ulje](https://carlab.rs/sr/parts/c/engine-oil/) — Ulje za motor.\n',
    );
    expect(body).not.toContain('RSD');
    expect(await generateLlmsTxt('ru')).toContain(
      '](https://carlab.rs/ru/parts/) — Каталог запчастей CarLab: у каждого номера детали своя страница с аналогами и характеристиками. Цен на сайте нет',
    );
    expect(await generateLlmsTxt('ru')).toContain(
      'Запчасти заказывают только по заявке',
    );
    expect(await generateLlmsTxt('ru')).toContain(
      'Менеджер проверит совместимость по VIN, назовет цену',
    );
  });

  it('links the BMW landing page', async () => {
    const body = await generateLlmsTxt('sr');
    expect(body).toContain(`](https://carlab.rs/sr/bmw/)`);
  });

  it('describes the parts catalogue on the parts index link', async () => {
    vi.stubEnv('SHOP_OPEN', 'true');
    const body = await generateLlmsTxt('ru').finally(() => vi.unstubAllEnvs());
    expect(body).toContain(
      '](https://carlab.rs/ru/parts/) — Каталог запчастей CarLab: у каждого номера детали своя страница с аналогами, ценой и наличием. Запчасти с ценой кладут в корзину и заказывают с самовывозом и оплатой наличными на СТО',
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
