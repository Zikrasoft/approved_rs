import { describe, expect, it } from 'vitest';
import WorkGrid from './WorkGrid.astro';
import { render } from './renderAstro';
import { work } from './workFixture';

describe('WorkGrid', () => {
  it('tags each card with its Make for the chip filter, and a Work without one with none', async () => {
    const root = await render(WorkGrid, {
      path: '/ru/works/',
      props: {
        works: [
          work({ id: 'a', car: 'Giulia', make: 'alfa-romeo' }),
          work({ id: 'b', car: 'Alfa Romeo Giulia', make: undefined }),
        ],
      },
    });
    const items = [...root.querySelectorAll<HTMLElement>('[data-filter-item]')];

    expect(items.map((item) => item.dataset.group)).toEqual([
      'alfa-romeo',
      undefined,
    ]);
  });

  it('loads only the first cards eagerly', async () => {
    const root = await render(WorkGrid, {
      path: '/ru/works/',
      props: {
        works: [work({ id: 'a' }), work({ id: 'b' })],
        eager: 1,
      },
    });

    expect(
      [...root.querySelectorAll('img')].map((img) =>
        img.getAttribute('loading'),
      ),
    ).toEqual(['eager', 'lazy']);
  });
});
