import { describe, expect, it, vi } from 'vitest';
import { withPlaceholder } from '@podbor/i18n';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import type { MakeHubEntry } from '@/utils/catalogueSnapshot';
import { work } from '@/components/workFixture';
import MakePage from './index.astro';

vi.mock('astro:content', () => ({ getCollection: vi.fn(async () => []) }));

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
        workshop: true,
      },
    });
    const labels = [
      ...page.querySelectorAll(`ul a[href^="/ru/parts/bmw/"]`),
    ].map((link) => link.textContent?.trim().split('\n')[0]);

    expect(labels).toEqual(['BMW 1', 'BMW 3 GT']);
  });

  const hubOf = (
    hubMake: { slug: string; name: string },
    locale = 'ru',
    workshop = true,
  ) =>
    render(MakePage, {
      path: `/${locale}/parts/${hubMake.slug}/`,
      params: { locale, make: hubMake.slug },
      props: {
        hub: {
          make: hubMake,
          series: [series('1', '1')],
          parts: 3,
        } as unknown as MakeHubEntry,
        workshop,
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

  it('links no Make page for a Make the site does not show', async () => {
    const page = await hubOf({ slug: 'tesla', name: 'Tesla' }, 'ru', false);

    expect(page.querySelector('a[href="/ru/cars/tesla/"]')).toBeNull();
  });
});

describe('the make hub cache key', () => {
  it('changes with what the page shows, not with the models under each series', async () => {
    const hubs = vi.hoisted(() => ({ value: [] as unknown[] }));
    vi.doMock('@/utils/catalogueEnv', () => ({
      makeHubsForBuild: async () => hubs.value,
    }));
    vi.resetModules();
    const { getStaticPaths } = await import('./index.astro');
    const keyOf = async (models: unknown[], name = '3') => {
      hubs.value = [
        {
          make,
          series: [{ ...series(name, name), models }],
          parts: models.length,
        },
      ];
      const [first] = await getStaticPaths();
      return first.cacheKey;
    };

    expect(await keyOf([{ id: 'a' }])).toBe(await keyOf([{ id: 'b' }]));
    expect(await keyOf([])).not.toBe(await keyOf([], '5'));
    vi.doUnmock('@/utils/catalogueEnv');
  });

  it('links the Make page only from the hub of a Make the site shows', async () => {
    vi.doMock('@/utils/catalogueEnv', () => ({
      makeHubsForBuild: async () =>
        [make, { slug: 'tesla', name: 'Tesla' }].map((hubMake) => ({
          make: hubMake,
          series: [],
          parts: 1,
        })),
    }));
    vi.resetModules();
    const { getCollection } = await import('astro:content');
    vi.mocked(getCollection).mockImplementation((async (collection: string) =>
      collection === 'works'
        ? [work({ id: 'bmw-x5', make: 'bmw' })]
        : []) as never);
    const { getStaticPaths } = await import('./index.astro');

    const paths = (await getStaticPaths()).filter(
      ({ params }) => params.locale === 'ru',
    );

    expect(
      paths.map(({ params, props }) => [params.make, props.workshop]),
    ).toEqual([
      ['bmw', true],
      ['tesla', false],
    ]);
    vi.doUnmock('@/utils/catalogueEnv');
  });
});
