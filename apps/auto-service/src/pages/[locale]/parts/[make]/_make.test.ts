import { describe, expect, it } from 'vitest';
import { withPlaceholder } from '@podbor/i18n';
import { content } from '@/i18n/content';
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

  const hubOf = (hubMake: { slug: string; name: string }, locale = 'ru') =>
    render(MakePage, {
      path: `/${locale}/parts/${hubMake.slug}/`,
      params: { locale, make: hubMake.slug },
      props: {
        hub: {
          make: hubMake,
          series: [series('1', '1')],
          parts: 3,
        } as unknown as MakeHubEntry,
      },
    });

  it.each(['ru', 'sr', 'en'] as const)(
    'links back to the Make page in %s',
    async (locale) => {
      const page = await hubOf(make, locale);

      expect(
        page
          .querySelector(`a[href="/${locale}/cars/bmw/"]`)
          ?.textContent?.trim(),
      ).toBe(
        withPlaceholder(
          content(locale).pages.make.headingTemplate,
          'make',
          'BMW',
        ),
      );
    },
  );

  it('links no Make page for a Make the exported list lacks', async () => {
    const page = await hubOf({ slug: 'tesla', name: 'Tesla' });

    expect(page.querySelector('a[href^="/ru/cars/"]')).toBeNull();
  });
});
