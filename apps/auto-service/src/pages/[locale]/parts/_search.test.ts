import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { render, setShop } from '@/components/renderAstro';
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
