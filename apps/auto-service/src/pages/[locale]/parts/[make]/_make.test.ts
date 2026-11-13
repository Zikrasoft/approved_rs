import { describe, expect, it } from 'vitest';
import { render } from '@/components/renderAstro';
import type { MakeHubEntry } from '@/utils/catalogueSnapshot';
import MakePage from './index.astro';

const make = { slug: 'bmw', name: 'BMW' };
const series = (name: string, slug: string) => ({
  series: { name, slug, translations: null, make },
  models: [],
  categories: [],
});

describe('the make hub', () => {
  it('names each series with its make', async () => {
    const page = await render(MakePage, {
      path: '/ru/parts/bmw/',
      params: { locale: 'ru', make: 'bmw' },
      props: {
        hub: {
          make,
          series: [series('3 GT', '3-gt'), series('1', '1')],
          parts: 0,
        } as unknown as MakeHubEntry,
      },
    });
    const labels = [
      ...page.querySelectorAll(`ul a[href^="/ru/parts/bmw/"]`),
    ].map((link) => link.textContent?.trim().split('\n')[0]);

    expect(labels).toEqual(['BMW 1', 'BMW 3 GT']);
  });
});
