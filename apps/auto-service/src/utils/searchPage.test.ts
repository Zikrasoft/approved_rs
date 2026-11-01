import { describe, expect, it, vi } from 'vitest';
import type { CarHit } from '@podbor/catalog-contract';
import { planSearch, type SearchCatalogue } from './searchPage';

const VIN = 'WBA35BG070N074158';
const make = { slug: 'bmw', name: 'BMW' };
const model = {
  slug: 'e83-x3-20d',
  name: 'X3 2.0d',
  chassis: {
    code: 'E83',
    body_style: 'suv' as const,
    series: { name: 'X3', translations: null, make },
  },
};
const modelPlace: CarHit = { kind: 'model', make, model, vehicle: null };
const makePlace: CarHit = { kind: 'make', make, model: null, vehicle: null };

const result = (normalized: string, slug: string) => ({
  normalized_value: normalized,
  slug,
});

const found = (count: number, results = [result('W71283', 'w-712-83')]) => ({
  count,
  limit: 20,
  results,
  cars: [],
  facets: [],
  category: null,
  model: null,
  scope_pages: null,
});

const fakeCatalogue = (
  overrides: Partial<Record<keyof SearchCatalogue, unknown>> = {},
) =>
  ({
    resolveVin: vi.fn(async () => ({ kind: 'inquiry', vin: VIN, place: null })),
    search: vi.fn(async () => found(1)),
    listingScope: vi.fn(async () => null),
    ...overrides,
  }) as unknown as SearchCatalogue;

const plan = (
  query: string,
  catalogue: SearchCatalogue | null = fakeCatalogue(),
) =>
  planSearch({ params: new URLSearchParams(query), locale: 'ru', catalogue });

describe('planSearch', () => {
  it('sees the car of a VIN the catalogue places on a page', async () => {
    const catalogue = fakeCatalogue({
      resolveVin: async () => ({
        kind: 'inquiry',
        vin: VIN,
        place: modelPlace,
      }),
    });
    expect(await plan(`q=${VIN}`, catalogue)).toEqual({
      redirect: '/ru/parts/bmw/e83-x3-20d/',
      status: 303,
    });
    expect(catalogue.search).not.toHaveBeenCalled();
  });

  it('stays on the inquiry for a VIN placed only on its make', async () => {
    const outcome = await plan(
      `q=${VIN}`,
      fakeCatalogue({
        resolveVin: async () => ({
          kind: 'inquiry',
          vin: VIN,
          place: makePlace,
        }),
      }),
    );
    expect(outcome).toMatchObject({
      status: 200,
      view: { vin: VIN, searchable: false, found: null },
    });
  });

  it('keeps a near-VIN as typed, so the inquiry asks about it and no stored car', async () => {
    expect(await plan('q=wba 35bg070n07415')).toMatchObject({
      view: { vin: null, vinTypo: 'WBA35BG070N07415' },
    });
    expect(await plan('q=filter')).toMatchObject({ view: { vinTypo: null } });
  });

  it('drops filters over the cap with a redirect', async () => {
    const facets = Array.from({ length: 9 }, (_, i) => `facets=k${i}:v`).join(
      '&',
    );
    const outcome = await plan(`q=filter&${facets}`);
    expect(outcome).toMatchObject({ status: 302 });
    const url = new URL(
      'redirect' in outcome ? outcome.redirect : '',
      'https://carlab.rs',
    );
    expect(url.pathname).toBe('/ru/parts/search/');
    expect(url.searchParams.getAll('facets')).toHaveLength(8);
  });

  it('sends an offset past the last page back to the last page', async () => {
    const catalogue = fakeCatalogue({ search: async () => found(45) });
    expect(await plan('q=filter&offset=200', catalogue)).toEqual({
      redirect: '/ru/parts/search/?q=filter&offset=40',
      status: 302,
    });
  });

  it('searches a query typed in the wrong keyboard layout as meant', async () => {
    const search = vi.fn(async ({ q }: { q: string }) =>
      q === 'oil filter'
        ? found(2, [result('A', 'a'), result('B', 'b')])
        : found(0, []),
    );
    const planned = await plan('q=щшд ашдеук', fakeCatalogue({ search }));

    expect(search).toHaveBeenCalledTimes(2);
    expect(planned).toMatchObject({ view: { q: 'oil filter' } });
    expect('view' in planned && planned.view.found?.count).toBe(2);
    expect('view' in planned && planned.view.searchHref([], [])).toBe(
      '/ru/parts/search/?q=oil+filter',
    );
  });

  it('keeps the typed query when the other layout finds nothing either', async () => {
    const search = vi.fn(async () => found(0, []));
    const planned = await plan('q=zzzz', fakeCatalogue({ search }));

    expect(search).toHaveBeenCalledTimes(2);
    expect(planned).toMatchObject({ view: { q: 'zzzz' } });
  });

  it('opens the one part whose number was searched', async () => {
    expect(await plan('q=W 712/83')).toEqual({
      redirect: '/ru/parts/p/w-712-83/',
      status: 302,
    });
  });

  it('keeps a filtered search on the list even for an exact number', async () => {
    expect(await plan('q=W71283&category=filters')).toMatchObject({
      status: 200,
      view: { category: 'filters' },
    });
  });

  it('answers 404 for a category the catalogue does not know', async () => {
    const outcome = await plan(
      'category=nope',
      fakeCatalogue({
        search: async () => null,
        listingScope: async () => ({
          category: null,
          model: null,
          scope_pages: null,
        }),
      }),
    );
    expect(outcome).toMatchObject({
      status: 404,
      view: { unknownScope: true },
    });
  });

  it('keeps the make only beside a model', async () => {
    const outcome = await plan('make=bmw&q=filter');
    expect(outcome).toMatchObject({ view: { make: undefined } });
  });

  it('keeps the model only beside its make', async () => {
    const outcome = await plan('model=x3&q=filter');
    expect(outcome).toMatchObject({ view: { model: undefined } });
  });

  it('lists what a Model category page counted for its ticked filter', async () => {
    const catalogue = fakeCatalogue();
    const outcome = await plan(
      'category=batteries&make=bmw&model=f30-320d&facets=brand%3Avarta',
      catalogue,
    );

    expect(catalogue.search).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'batteries',
        make: 'bmw',
        model: 'f30-320d',
        facets: ['brand:varta'],
      }),
    );
    expect(outcome).toMatchObject({
      status: 200,
      view: { make: 'bmw', model: 'f30-320d', found: { count: 1 } },
    });
  });

  it('builds links that keep the scope and drop a zero offset', async () => {
    const outcome = await plan('q=filter&make=bmw&model=x3');
    if (!('view' in outcome)) throw new Error('expected a view');
    expect(
      outcome.view.searchHref(
        ['side:front'],
        [{ key: 'w', min: 1, max: null }],
        0,
      ),
    ).toBe(
      '/ru/parts/search/?q=filter&make=bmw&model=x3&facets=side%3Afront&min.w=1',
    );
    expect(outcome.view.searchHref([], [], 20, '')).toBe(
      '/ru/parts/search/?q=filter&offset=20',
    );
  });

  it('shows a dead end when the shop is unreachable', async () => {
    expect(await plan('q=filter', null)).toMatchObject({
      status: 200,
      view: { searchable: true, found: null, unknownScope: false },
    });
  });
});
