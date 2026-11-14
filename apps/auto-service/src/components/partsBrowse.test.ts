import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import {
  PARTS_BROWSE_ATTRIBUTE,
  PARTS_BROWSE_STATUS_ATTRIBUTE,
} from '@/scripts/partsBrowse';
import PartsBrowse from './PartsBrowse.astro';
import { render } from './renderAstro';

const copy = content('ru').partsSearch;

const result = (value: string) => ({
  id: `pi_${value}`,
  type: 'manufacturer-number',
  value,
  normalized_value: value,
  superseded: false,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  part: {
    id: `part_${value}`,
    name: 'Масляный фильтр',
    attributes: null,
    category: { slug: 'oil-filters', name: 'Масляные фильтры' },
  },
  offers: [],
  thumbnail: null,
  thumbnail_illustration: false,
  demand: null,
  slug: `mann-filter-${value.toLowerCase()}`,
  specs: '',
});

const found = {
  results: [result('HU1'), result('HU2')],
  facets: [],
  category: null,
  model: null,
  cars: [],
  scope_pages: null,
  count: 26,
  offset: 12,
  limit: 12,
};

const browse = (props: Record<string, unknown>) =>
  render(PartsBrowse, {
    props: { found, prev: null, next: null, ...props },
  }).then((html) => html.querySelector(`[${PARTS_BROWSE_ATTRIBUTE}]`)!);

describe('the parts browse list', () => {
  const range = copy.shownRange
    .replace('{from}', '13')
    .replace('{to}', '14')
    .replace('{count}', '26');

  it('says which parts of how many it shows, for the page that swaps it in', async () => {
    expect((await browse({})).getAttribute(PARTS_BROWSE_STATUS_ATTRIBUTE)).toBe(
      range,
    );
  });

  it('shows the same range beside the pager', async () => {
    const list = await browse({ next: '/ru/parts/search/?offset=24' });
    expect(list.querySelector('nav')?.previousElementSibling?.textContent).toBe(
      range,
    );
  });

  it('lists each part with its category outside a category', async () => {
    const list = await browse({});

    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(list.textContent).toContain('Масляные фильтры');
  });

  it('shows a thumbnail where the part has one', async () => {
    const list = await browse({
      found: {
        ...found,
        results: [
          {
            ...result('HU3'),
            thumbnail: 'https://cdn.test/hu3.webp',
            thumbnail_illustration: true,
          },
        ],
      },
    });

    expect(list.querySelector('img')?.getAttribute('src')).toContain(
      'hu3.webp',
    );
  });

  it('leaves the category out inside one', async () => {
    expect(
      (await browse({ category: 'oil-filters' })).textContent,
    ).not.toContain('Масляные фильтры');
  });

  it('pages both ways with the links it is given', async () => {
    const list = await browse({
      prev: '/ru/parts/search/',
      next: '/ru/parts/search/?offset=24',
    });

    expect(list.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe(
      '/ru/parts/search/',
    );
    expect(list.querySelector('a[rel="next"]')?.getAttribute('href')).toBe(
      '/ru/parts/search/?offset=24',
    );
  });

  it('draws no pager on the only page', async () => {
    expect((await browse({})).querySelector('nav')).toBeNull();
  });
});
