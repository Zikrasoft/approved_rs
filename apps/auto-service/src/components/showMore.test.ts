import { describe, expect, it } from 'vitest';
import ShowMore from './ShowMore.astro';
import { isOrange, render } from './renderAstro';

describe('ShowMore', () => {
  it('folds the rest behind an ink toggle, open when asked', async () => {
    const closed = await render(ShowMore, { props: { label: 'Еще 4' } });
    const open = await render(ShowMore, {
      props: { label: 'Еще 4', open: true },
    });
    const summary = closed.querySelector('details > summary')!;

    expect(summary.textContent?.trim()).toBe('Еще 4');
    expect(isOrange(summary)).toBe(false);
    expect(closed.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(open.querySelector('details')?.hasAttribute('open')).toBe(true);
  });
});
