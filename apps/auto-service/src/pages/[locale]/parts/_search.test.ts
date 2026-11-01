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
