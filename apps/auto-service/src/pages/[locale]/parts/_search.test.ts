import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { isOrange, render, setShop } from '@/components/renderAstro';
import SearchPage from './search.astro';

const copy = content('ru').partsSearch;

const answer = (count: number) => ({
  results: [],
  facets: [
    {
      key: 'brand',
      type: 'multi-select',
      label: 'brand',
      unit: null,
      values: [{ value: 'bosch', label: 'Bosch', count: 0 }],
    },
  ],
  category: { slug: 'batteries', name: 'Аккумуляторы' },
  model: null,
  cars: [],
  count,
  offset: 0,
  limit: 20,
});

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  setShop(false);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(answer(url.includes('limit=1') ? 5 : 0)),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const zeroPage = () =>
  render(SearchPage, {
    path: '/ru/parts/search/?category=batteries&facets=brand%3Abosch',
  });

describe('the search page when the chosen filters find nothing', () => {
  it('offers the manual pick instead of a zero', async () => {
    const page = await zeroPage();

    expect(page.textContent).not.toContain(copy.found.replace('{count}', '0'));
    expect(page.textContent).toContain(copy.noFilteredResults);
  });

  it('opens the inquiry with the chosen filters in its comment', async () => {
    const page = await zeroPage();
    const card = page.querySelector('#inquiry')!;

    expect(card.querySelector('textarea')?.textContent).toContain(
      'Аккумуляторы, Бренд: Bosch',
    );
  });

  it('points the filter button at that inquiry', async () => {
    const submit = (await zeroPage()).querySelector(
      'filter-sheet button[type="submit"]',
    )!;

    expect(submit.textContent?.trim()).toBe(copy.noneFound);
    expect(submit.getAttribute('formaction')).toBe('/ru/parts/search/#inquiry');
  });
});

describe('the search page for a query whose chosen filters find nothing', () => {
  const queryPage = () =>
    render(SearchPage, {
      path: '/ru/parts/search/?q=bosch&category=batteries&facets=brand%3Abosch',
    });

  it('says the query and the filters go into the inquiry', async () => {
    const page = await queryPage();

    expect(page.textContent).toContain(
      copy.noFilteredQueryResults.replace('{q}', 'bosch'),
    );
    expect(page.textContent).not.toContain(
      copy.noResults.replace('{q}', 'bosch'),
    );
  });

  it('keeps the plain query zero state for a query without filters', async () => {
    const page = await render(SearchPage, {
      path: '/ru/parts/search/?q=bosch',
    });

    expect(page.textContent).toContain(copy.noResults.replace('{q}', 'bosch'));
  });

  it('leads the dead end with the orange call and keeps the prefilled WhatsApp second', async () => {
    const page = await render(SearchPage, {
      path: '/ru/parts/search/?q=bosch',
    });
    const tiles = [
      ...page.querySelectorAll<HTMLElement>(
        '[data-contact-placement="bar"] [data-contact-channel]',
      ),
    ];

    expect(tiles.map((tile) => tile.dataset.contactChannel)).toEqual([
      'phone',
      'whatsapp',
      'viber',
      'telegram',
    ]);
    expect(
      tiles.filter(isOrange).map((tile) => tile.dataset.contactChannel),
    ).toEqual(['phone']);
    expect(tiles[1].getAttribute('href')).toContain('text=');
  });

  it('opens the inquiry with the query ahead of the filters', async () => {
    const card = (await queryPage()).querySelector('#inquiry')!;

    expect(card.querySelector('textarea')?.textContent).toContain(
      'bosch, Аккумуляторы, Бренд: Bosch',
    );
  });
});

describe('the search page for filters that narrowed facets away', () => {
  it('keeps those facets in the sheet, hidden, for a live count to bring back', async () => {
    const polarity = {
      key: 'polarity',
      type: 'multi-select',
      label: 'polarity',
      unit: null,
      values: [{ value: 'direct', label: 'direct', count: 2 }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const unfiltered = url.includes('limit=1');
        const body = answer(unfiltered ? 5 : 1);
        return Response.json({
          ...body,
          facets: unfiltered ? [...body.facets, polarity] : body.facets,
        });
      }),
    );
    const page = await render(SearchPage, {
      path: '/ru/parts/search/?category=batteries&facets=brand%3Abosch',
    });
    const fieldset = (key: string) =>
      page.querySelector<HTMLFieldSetElement>(`[data-facet-key="${key}"]`);

    expect(fieldset('brand')?.hidden).toBe(false);
    expect(fieldset('polarity')?.hidden).toBe(true);
  });
});

describe('a category listed by demand on the search page', () => {
  const result = (value: string, top: boolean) => ({
    id: `pi_${value}`,
    type: 'manufacturer-number',
    value,
    normalized_value: value,
    superseded: false,
    brand: { name: 'Varta', slug: 'varta' },
    part: {
      id: `part_${value}`,
      name: 'Аккумулятор',
      category: { slug: 'batteries', name: 'Аккумуляторы' },
      attributes: null,
    },
    offers: [],
    thumbnail: null,
    demand: { score: top ? 9 : 3, popular: top, top },
  });
  const listed = {
    ...answer(2),
    results: [result('E11', true), result('E12', false)],
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(listed)),
    );
  });

  const popularPage = () =>
    render(SearchPage, {
      path: '/ru/parts/search/?category=batteries&sort=popular',
    });

  it('asks the shop for the popular order and marks it current', async () => {
    const page = await popularPage();

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('sort=popular');
    expect(
      [...page.querySelectorAll('nav[aria-label="Порядок"] a')].map((link) => [
        link.getAttribute('href'),
        link.getAttribute('aria-current'),
      ]),
    ).toEqual([
      ['/ru/parts/c/batteries/', null],
      ['/ru/parts/search/?category=batteries&sort=popular', 'page'],
    ]);
  });

  it('badges the top part of the category', async () => {
    const page = await popularPage();

    expect(page.querySelectorAll('[data-demand-badge]')).toHaveLength(1);
  });

  it('keeps the order when filters are applied', async () => {
    const page = await popularPage();

    expect(
      page
        .querySelector('form input[type="hidden"][name="sort"]')
        ?.getAttribute('value'),
    ).toBe('popular');
  });

  it('offers no popular order for a listing nothing in which is demanded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...listed,
          results: listed.results.map((item) => ({ ...item, demand: null })),
        }),
      ),
    );
    const page = await render(SearchPage, {
      path: '/ru/parts/search/?category=batteries',
    });

    expect(page.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });

  it('offers no order for a typed query, where relevance leads', async () => {
    const page = await render(SearchPage, {
      path: '/ru/parts/search/?q=varta',
    });

    expect(page.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });
});

describe('the search page scoped to one Model', () => {
  const model = {
    slug: 'e83-x3-20d',
    name: 'X3 2.0d',
    chassis: {
      code: 'E83',
      body_style: 'suv',
      series: {
        name: 'X3',
        translations: null,
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...answer(0),
          category: null,
          model,
          scope_pages: { make: true, series: true },
        }),
      ),
    );
  });

  const modelPage = () =>
    render(SearchPage, {
      path: '/ru/parts/search/?make=bmw&model=e83-x3-20d',
    });

  it('lists the Parts of the Model without a query or a category', async () => {
    await modelPage();

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain(
      'make=bmw&model=e83-x3-20d',
    );
  });

  it('walks up through the Make and the Series pages', async () => {
    const page = await modelPage();

    expect(page.querySelector('a[href="/ru/parts/bmw/"]')).not.toBeNull();
    expect(page.querySelector('a[href="/ru/parts/bmw/x3/"]')).not.toBeNull();
  });

  it('hands the car to My garage', async () => {
    const facts = (await modelPage()).querySelector('car-facts');

    expect(facts?.getAttribute('data-make')).toBe('bmw');
    expect(facts?.getAttribute('data-series')).toBe('x3');
    expect(facts?.getAttribute('data-model')).toBe('e83-x3-20d');
  });
});
