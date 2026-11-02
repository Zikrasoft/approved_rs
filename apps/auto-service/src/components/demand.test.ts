import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import FittedPart from './FittedPart.astro';
import ListingSort from './ListingSort.astro';
import PartRow from './PartRow.astro';
import PopularParts from './PopularParts.astro';
import { isOrange, partPage, render, setShop } from './renderAstro';

const copy = content('ru').partsSearch;

const top = { score: 13, popular: true, top: true };
const popularOnly = { score: 8, popular: true, top: false };

const badges = (element: Element) =>
  [...element.querySelectorAll('[data-demand-badge]')].map((badge) =>
    badge.textContent?.trim(),
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the demand badge', () => {
  const row = (demand: typeof top | null) =>
    render(PartRow, {
      props: {
        thumb: null,
        slug: 'bosch-1',
        brand: 'Bosch',
        value: '1',
        demand,
      },
    });

  it('marks a part row that tops its Category, in no orange', async () => {
    const marked = await row(top);

    expect(badges(marked)).toEqual([copy.popularBadge]);
    expect(isOrange(marked.querySelector('[data-demand-badge]')!)).toBe(false);
  });

  it('marks no part row that is popular but not among the top, or has no Demand', async () => {
    expect(badges(await row(popularOnly))).toEqual([]);
    expect(badges(await row(null))).toEqual([]);
  });

  it('marks a fitted part when any of its numbers tops its Category', async () => {
    setShop(false);
    const fitted = (demand: typeof top | null) =>
      render(FittedPart, {
        props: {
          pages: [
            partPage(),
            partPage({ id: 'pi_ate', slug: 'ate-1', demand }),
          ],
          name: 'Колодки',
        },
      });

    expect(badges(await fitted(top))).toEqual([copy.popularBadge]);
    expect(badges(await fitted(null))).toEqual([]);
  });
});

describe('the popular parts block', () => {
  const pages = [
    partPage({ id: 'pi_a', slug: 'bosch-a', value: 'A', demand: popularOnly }),
    partPage({
      id: 'pi_b',
      slug: 'bosch-b',
      value: 'B',
      demand: top,
      part: { ...partPage().part, id: 'part_b' },
    }),
  ];

  it('lists the popular parts most demanded first under its heading', async () => {
    const block = await render(PopularParts, { props: { pages } });

    expect(block.querySelector('h2')?.textContent?.trim()).toBe(
      copy.popularHeading,
    );
    expect(
      [...block.querySelectorAll('li a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/ru/parts/p/bosch-b/', '/ru/parts/p/bosch-a/']);
  });

  it('names the car it was narrowed to', async () => {
    const block = await render(PopularParts, {
      props: { pages, car: 'BMW X3 E83' },
    });

    expect(block.querySelector('h2')?.textContent?.trim()).toBe(
      copy.popularForCar.replace('{car}', 'BMW X3 E83'),
    );
  });

  it('renders nothing below two popular parts', async () => {
    const block = await render(PopularParts, {
      props: { pages: [pages[0], partPage({ id: 'pi_c', slug: 'bosch-c' })] },
    });

    expect(block.innerHTML.trim()).toBe('');
  });
});

describe('the listing order', () => {
  const sort = (current: 'popular' | null) =>
    render(ListingSort, {
      props: {
        current,
        hrefs: {
          default: '/ru/parts/c/batteries/',
          popular: '/ru/parts/search/?category=batteries&sort=popular',
        },
      },
    });
  const links = (nav: Element) =>
    [...nav.querySelectorAll('a')].map((link) => ({
      label: link.textContent?.trim(),
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    }));

  it('links both orders and marks the default one as current', async () => {
    const nav = await sort(null);

    expect(nav.querySelector('nav')?.getAttribute('aria-label')).toBe(
      copy.sortLabel,
    );
    expect(links(nav)).toEqual([
      {
        label: copy.sortDefault,
        href: '/ru/parts/c/batteries/',
        current: 'page',
      },
      {
        label: copy.sortPopular,
        href: '/ru/parts/search/?category=batteries&sort=popular',
        current: null,
      },
    ]);
  });

  it('marks the popular order as current, in no orange', async () => {
    const nav = await sort('popular');

    expect(links(nav).map(({ current }) => current)).toEqual([null, 'page']);
    expect([...nav.querySelectorAll('a')].some(isOrange)).toBe(false);
  });
});
