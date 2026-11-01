import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import StickyContactBar from './StickyContactBar.astro';
import { render } from './renderAstro';

const site = content('ru').site;

describe('StickyContactBar', async () => {
  const bar = await render(StickyContactBar, { path: '/ru/services/' });
  const call = bar.querySelector('a[href^="tel:"]')!;
  const lead = bar.querySelector('[data-open-lead-modal]')!;
  const classes = (element: Element) => [...element.classList];

  it('paints the call orange, the cell a touchscreen reaches for first', () => {
    expect(classes(call)).toEqual(
      expect.arrayContaining([
        'bg-signal-ink',
        'text-white',
        'pointer-fine:hidden!',
      ]),
    );
  });

  it('leaves the lead cell neutral on touch and orange on a mouse, where the call is gone', () => {
    expect(lead.textContent?.trim()).toBe(site.header.partsCta);
    expect(classes(lead)).toContain('text-ink');
    expect(classes(lead)).not.toContain('bg-signal-ink');
    expect(classes(lead)).toEqual(
      expect.arrayContaining([
        'pointer-fine:bg-signal-ink',
        'pointer-fine:text-white',
      ]),
    );
  });

  it('keeps the messenger cell quiet', () => {
    const messenger = bar.querySelector('[data-primary-channel="telegram"]')!;

    expect(classes(messenger)).toContain('text-ink');
    expect(classes(messenger)).not.toContain('bg-signal-ink');
  });
});
