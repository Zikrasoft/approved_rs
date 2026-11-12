import { describe, expect, it } from 'vitest';
import GoogleRating from './GoogleRating.astro';
import { render } from './renderAstro';

const rating = async (tone: 'panel' | 'card') =>
  (await render(GoogleRating, { path: '/ru/', props: { tone } })).querySelector(
    'a',
  )!;

describe('GoogleRating', () => {
  it('states the Google rating and review count', async () => {
    expect((await rating('card')).textContent?.trim()).toBe(
      '5.0 в Google · 18 отзывов',
    );
  });

  it('opens the garage place on Google Maps in a new tab', async () => {
    const link = await rating('panel');

    expect(link.getAttribute('href')).toBe(
      'https://maps.google.com/?cid=4988774890072933706',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('takes the colours of the surface it sits on', async () => {
    expect((await rating('panel')).classList.contains('text-panel-fg')).toBe(
      true,
    );
    expect((await rating('card')).classList.contains('text-ink')).toBe(true);
  });
});
