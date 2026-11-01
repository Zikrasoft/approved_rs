import { describe, expect, it } from 'vitest';
import type { SearchFacet } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import FacetFilters from './FacetFilters.astro';
import { render } from './renderAstro';
import { RANGE_LIMIT } from '@/utils/partsSearch';

const copy = content('ru').partsSearch;

const facet = (
  key: string,
  values: [string, number][],
  over: Partial<SearchFacet> = {},
): SearchFacet =>
  ({
    key,
    type: 'multi-select',
    label: key,
    unit: null,
    values: values.map(([value, count]) => ({ value, label: value, count })),
    ...over,
  }) as SearchFacet;

const filters = (props: Record<string, unknown> = {}) =>
  render(FacetFilters, {
    path: '/ru/parts/search/',
    props: {
      action: '/ru/parts/search/',
      hidden: { category: 'batteries' },
      facets: [],
      ...props,
    },
  });

const boxes = (root: Element, name: string) => [
  ...root.querySelectorAll<HTMLInputElement>(`input[value^="${name}:"]`),
];

describe('the facet filters', () => {
  it('keeps the page scope in hidden fields of a GET form', async () => {
    const form = (await filters()).querySelector('form')!;

    expect(form.getAttribute('method')).toBe('GET');
    expect(form.getAttribute('action')).toBe('/ru/parts/search/');
    expect(
      form
        .querySelector('input[type="hidden"][name="category"]')
        ?.getAttribute('value'),
    ).toBe('batteries');
    expect(
      form.querySelector('filter-sheet')?.getAttribute('data-count-url'),
    ).toBe('/api/search-count?locale=ru');
  });

  it('shows a few values as pills and a brand facet as a list', async () => {
    const root = await filters({
      facets: [
        facet('voltage', [
          ['12', 4],
          ['24', 1],
        ]),
        facet('brand', [['varta', 3]]),
      ],
    });

    expect(boxes(root, 'voltage')[0].classList.contains('sr-only')).toBe(true);
    expect(boxes(root, 'brand')[0].classList.contains('sr-only')).toBe(false);
  });

  it('folds the values past the first six behind a show all control, open when one of them is chosen', async () => {
    const many = facet(
      'size',
      Array.from({ length: 8 }, (_, index): [string, number] => [
        `s${index}`,
        1,
      ]),
    );
    const closed = await filters({ facets: [many] });
    const opened = await filters({ facets: [many], chosen: ['size:s7'] });
    const more = (root: Element) => root.querySelector('fieldset details')!;

    expect(more(closed).querySelectorAll('input')).toHaveLength(2);
    expect(more(closed).querySelector('summary')?.textContent?.trim()).toBe(
      copy.showAllValues.replace('{count}', '8'),
    );
    expect(more(closed).hasAttribute('open')).toBe(false);
    expect(more(opened).hasAttribute('open')).toBe(true);
    expect(boxes(opened, 'size').find(({ checked }) => checked)?.value).toBe(
      'size:s7',
    );
  });

  it('offers only the yes side of a boolean facet', async () => {
    const root = await filters({
      facets: [
        facet(
          'agm',
          [
            ['true', 2],
            ['false', 5],
          ],
          { type: 'boolean' },
        ),
      ],
    });

    expect(boxes(root, 'agm').map(({ value }) => value)).toEqual(['agm:true']);
    expect(root.querySelector('fieldset')?.textContent).toContain(
      copy.booleanTrue,
    );
  });

  it('disables a value with no results unless it is the chosen one', async () => {
    const root = await filters({
      facets: [
        facet('voltage', [
          ['12', 0],
          ['24', 0],
        ]),
      ],
      chosen: ['voltage:24'],
    });
    const [none, chosen] = boxes(root, 'voltage');

    expect(none.disabled).toBe(true);
    expect(chosen.disabled).toBe(false);
  });

  it('gives a number facet a range with the bounds as hints and the chosen range as values', async () => {
    const root = await filters({
      facets: [
        facet(
          'capacity',
          [
            ['60', 2],
            ['95', 1],
          ],
          {
            type: 'number',
            unit: 'Ah',
          },
        ),
      ],
      ranges: [{ key: 'capacity', min: 70, max: null }],
    });
    const min = root.querySelector<HTMLInputElement>('[name="min.capacity"]')!;
    const max = root.querySelector<HTMLInputElement>('[name="max.capacity"]')!;

    expect(root.querySelector('legend')?.textContent).toBe('capacity, Ah');
    expect(min.value).toBe('70');
    expect(max.hasAttribute('value')).toBe(false);
    expect(min.placeholder).toBe(copy.rangeFrom.replace('{min}', '60'));
    expect(max.placeholder).toBe(copy.rangeTo.replace('{max}', '95'));
  });

  it('leaves a number facet with no numeric values without hints', async () => {
    const root = await filters({
      facets: [facet('capacity', [['n/a', 1]], { type: 'number' })],
    });

    expect(
      root.querySelector('[name="min.capacity"]')?.hasAttribute('placeholder'),
    ).toBe(false);
  });

  it('counts the active filters and offers a reset only then', async () => {
    const idle = await filters({ resetHref: '/ru/parts/search/?q=x' });
    const active = await filters({
      chosen: ['brand:varta'],
      ranges: [{ key: 'capacity', min: 60, max: 80 }],
      resetHref: '/ru/parts/search/?q=x',
    });

    expect(idle.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(idle.textContent).not.toContain(copy.resetFilters);
    expect(active.querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(active.querySelector('h2')?.textContent).toContain('· 2');
    expect(
      [...active.querySelectorAll('a')]
        .find((link) => link.textContent?.trim() === copy.resetFilters)
        ?.getAttribute('href'),
    ).toBe('/ru/parts/search/?q=x');
  });

  it('labels the submit with the result count when it is known', async () => {
    const counted = await filters({ count: 42 });
    const unknown = await filters();
    const submit = (root: Element) =>
      root.querySelector('button[type="submit"]')!;

    expect(submit(counted).textContent?.trim()).toBe(
      copy.showResults.replace('{count}', '42'),
    );
    expect(submit(unknown).textContent?.trim()).toBe(copy.applyFilters);
    expect(submit(unknown).getAttribute('data-filters-count')).toBe(
      copy.showResults,
    );
  });

  it('turns a count of zero into a button to the inquiry that carries the filters', async () => {
    const submit = (
      await filters({ count: 0 })
    ).querySelector<HTMLButtonElement>('button[type="submit"]')!;

    expect(submit.textContent?.trim()).toBe(copy.noneFound);
    expect(submit.disabled).toBe(false);
    expect(submit.getAttribute('formaction')).toBe('/ru/parts/search/#inquiry');
    expect(submit.getAttribute('data-filters-none')).toBe(copy.noneFound);
    expect(submit.getAttribute('data-filters-inquiry')).toBe(
      '/ru/parts/search/#inquiry',
    );
  });

  it('sends a counted search to the results, not the inquiry', async () => {
    const submit = (
      await filters({ count: 3 })
    ).querySelector<HTMLButtonElement>('button[type="submit"]')!;

    expect(submit.hasAttribute('formaction')).toBe(false);
  });

  it('names each facet group and keeps a polite region for the live count', async () => {
    const root = await filters({ facets: [facet('brand', [['varta', 3]])] });

    expect(root.querySelector('fieldset')?.getAttribute('data-facet-key')).toBe(
      'brand',
    );
    expect(
      root.querySelector('[data-filters-live]')?.getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('marks each value count so the sheet can recount it', async () => {
    const root = await filters({
      facets: [facet('brand', [['varta', 3]])],
    });

    expect(
      boxes(root, 'brand')[0]
        .closest('label')
        ?.querySelector('[data-facet-count]')?.textContent,
    ).toBe('3');
  });

  it('bounds a range box to the numbers the search accepts', async () => {
    const root = await filters({
      facets: [
        facet(
          'capacity',
          [
            ['60', 2],
            ['95', 1],
          ],
          { type: 'number' },
        ),
      ],
    });
    const min = root.querySelector<HTMLInputElement>('[name="min.capacity"]')!;

    expect(min.min).toBe('0');
    expect(Number(min.max)).toBe(RANGE_LIMIT);
  });
});
