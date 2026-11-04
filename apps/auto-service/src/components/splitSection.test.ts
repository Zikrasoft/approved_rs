import { describe, expect, it } from 'vitest';
import SplitSection from './SplitSection.astro';
import { render } from './renderAstro';

const split = (slots: Record<string, string>) =>
  render(SplitSection, { path: '/ru/', props: { class: 'mt-4' }, slots });

describe('SplitSection', () => {
  it('keeps head, content and aside in reading order for the phone layout', async () => {
    const root = await split({
      head: '<h2>head</h2>',
      default: '<ul>content</ul>',
      aside: '<p>aside</p>',
    });
    const grid = root.firstElementChild!;

    expect(grid.classList.contains('mt-4')).toBe(true);
    expect([...grid.children].map((cell) => cell.textContent?.trim())).toEqual([
      'head',
      'content',
      'aside',
    ]);
  });

  it('leaves no empty aside cell when there is nothing to put aside', async () => {
    const root = await split({ head: '<h2>head</h2>', default: '<ul></ul>' });

    expect(root.firstElementChild!.children).toHaveLength(2);
  });
});
