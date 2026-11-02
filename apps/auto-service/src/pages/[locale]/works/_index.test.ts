import { getCollection } from 'astro:content';
import { describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import { work } from '@/components/workFixture';
import WorksIndex from './index.astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));

const { pages, site } = content('ru');
const page = async (works: ReturnType<typeof work>[]) => {
  vi.mocked(getCollection).mockResolvedValue(works as never);
  return render(WorksIndex as never, {
    path: '/ru/works/',
    params: { locale: 'ru' },
  });
};
const chips = (root: Element) => [
  ...root.querySelectorAll<HTMLButtonElement>('[data-filter-chip]'),
];

describe('the works list', () => {
  it('leads with the featured Works', async () => {
    const root = await page([
      work({ id: 'newest', date: new Date('2026-10-01') }),
      work({ id: 'picked', featured: true }),
    ]);

    expect(
      [...root.querySelectorAll('[data-filter-item] a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/ru/works/picked/', '/ru/works/newest/']);
  });

  it('offers a chip for each make two Works share, all pressed by default', async () => {
    const root = await page([
      work({ id: 'a', car: 'BMW X3' }),
      work({ id: 'b', car: 'BMW 118D' }),
      work({ id: 'c', car: 'VW Golf' }),
    ]);

    expect(chips(root).map((chip) => chip.textContent?.trim())).toEqual([
      pages.works.filterAll,
      'BMW',
    ]);
    expect(
      chips(root).map((chip) => chip.getAttribute('aria-pressed')),
    ).toEqual(['true', 'false']);
    expect(chips(root)[1].dataset.group).toBe('bmw');
    expect(
      root.querySelector('[role="group"]')?.getAttribute('aria-label'),
    ).toBe(pages.works.filterLabel);
  });

  it('shows no chips when no make repeats', async () => {
    expect(
      chips(await page([work({ id: 'a' }), work({ id: 'b', car: 'VW Golf' })])),
    ).toEqual([]);
  });

  it('says the list is coming when there is no Work yet', async () => {
    const root = await page([]);

    expect(root.textContent).toContain(site.common.emptyWorks);
    expect(root.querySelector('chip-filter')).toBeNull();
  });
});
