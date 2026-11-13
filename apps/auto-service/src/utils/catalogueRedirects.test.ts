import { describe, expect, it } from 'vitest';
import {
  cataloguePlaceSchema,
  type CatalogueRedirect,
} from '@podbor/catalog-contract';
import {
  catalogueRoutes,
  type RedirectRoute,
  withCatalogueRoutes,
} from './catalogueRedirects';
import type { CataloguePages } from './paths';

const pagesOf = ({
  makes = [],
  series = [],
  categories = [],
}: Partial<Record<keyof CataloguePages, string[]>>): CataloguePages => ({
  makes: new Set(makes),
  series: new Set(series),
  categories: new Set(categories),
});

const redirect = (
  from: Record<string, string>,
  to: Record<string, string>,
): CatalogueRedirect => ({
  from: cataloguePlaceSchema.parse(from),
  to: cataloguePlaceSchema.parse(to),
});

const follow = (routes: RedirectRoute[], path: string) => {
  for (const route of routes) {
    const match = new RegExp(route.src).exec(path);
    if (match) {
      return {
        status: route.status,
        location: route.headers.Location.replace(
          /\$(\d+)/g,
          (_, group: string) => match[Number(group)] ?? '',
        ),
      };
    }
  }
  return null;
};

const moved = (location: string) => ({ status: 301, location });

describe('catalogueRoutes', () => {
  it('routes nothing for a renamed Model or Vehicle, neither of which has a page', () => {
    expect(
      catalogueRoutes(
        [
          redirect(
            { make: 'volkswagen', model: 'vw-golf' },
            { make: 'volkswagen', model: 'golf' },
          ),
          redirect(
            { make: 'volkswagen', model: 'vw-golf', vehicle: 'caxa-90kw' },
            { make: 'volkswagen', model: 'golf' },
          ),
        ],
        pagesOf({ makes: ['volkswagen'], series: ['volkswagen/golf'] }),
      ),
    ).toEqual([]);
  });

  it('301s every page under a renamed Make, in every locale', () => {
    const routes = catalogueRoutes(
      [redirect({ make: 'bmw-old' }, { make: 'bmw' })],
      pagesOf({ makes: ['bmw'] }),
    );

    expect(follow(routes, '/sr/parts/bmw-old/')).toEqual(
      moved('/sr/parts/bmw/'),
    );
    expect(follow(routes, '/ru/parts/bmw-old')).toEqual(
      moved('/ru/parts/bmw/'),
    );
    expect(follow(routes, '/en/parts/bmw-old/3-series/oil-filters/')).toEqual(
      moved('/en/parts/bmw/3-series/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw-oldtimer/')).toBeNull();
  });

  it('301s a renamed Category, its listing pages and its pages under every Series', () => {
    const routes = catalogueRoutes(
      [redirect({ category: 'oil' }, { category: 'oil-filters' })],
      pagesOf({
        makes: ['bmw'],
        series: ['bmw/3-series'],
        categories: ['bmw/3-series/oil-filters'],
      }),
    );

    expect(follow(routes, '/sr/parts/c/oil/')).toEqual(
      moved('/sr/parts/c/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/c/oil/3/')).toEqual(
      moved('/sr/parts/c/oil-filters/3/'),
    );
    expect(follow(routes, '/sr/parts/bmw/3-series/oil/')).toEqual(
      moved('/sr/parts/bmw/3-series/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw/3-series/oil-filters/')).toBeNull();
  });

  it('301s each part page of a renamed Brand without touching a Brand that shares its start', () => {
    const routes = catalogueRoutes(
      [redirect({ brand: 'mann' }, { brand: 'mann-filter' })],
      pagesOf({}),
    );

    expect(follow(routes, '/sr/parts/p/mann-hu816x/')).toEqual(
      moved('/sr/parts/p/mann-filter-hu816x/'),
    );
    expect(follow(routes, '/sr/parts/p/mann-filter-hu816x/')).toBeNull();
  });

  it('falls back from a Make without a page to the parts index', () => {
    const routes = catalogueRoutes(
      [redirect({ make: 'vw' }, { make: 'volkswagen' })],
      pagesOf({ makes: ['bmw'] }),
    );

    expect(follow(routes, '/sr/parts/vw/golf/')).toEqual(moved('/sr/parts/'));
  });

  it('sends a renamed Category under a Series only from a Series page, to the Series page when it lacks the Category', () => {
    const routes = catalogueRoutes(
      [redirect({ category: 'oil' }, { category: 'oil-filters' })],
      pagesOf({
        makes: ['bmw'],
        series: ['bmw/3-series', 'bmw/5-series'],
        categories: ['bmw/3-series/oil-filters'],
      }),
    );

    expect(follow(routes, '/sr/parts/bmw/3-series/oil/')).toEqual(
      moved('/sr/parts/bmw/3-series/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw/5-series/oil/')).toEqual(
      moved('/sr/parts/bmw/5-series/'),
    );
    expect(follow(routes, '/sr/parts/bmw/x5/oil/')).toBeNull();
  });

  it('sends a deleted part to its Category and a deleted Make or Category to the nearest page', () => {
    const routes = catalogueRoutes(
      [
        redirect({ part: 'mann-filter-w712' }, { category: 'oil-filters' }),
        redirect({ make: 'zz' }, {}),
        redirect({ category: 'gone' }, {}),
      ],
      pagesOf({ makes: ['bmw'], series: ['bmw/3-series'] }),
    );

    expect(follow(routes, '/sr/parts/p/mann-filter-w712/')).toEqual(
      moved('/sr/parts/c/oil-filters/'),
    );
    expect(follow(routes, '/ru/parts/zz/x5/')).toEqual(moved('/ru/parts/'));
    expect(follow(routes, '/sr/parts/bmw/3-series/gone/')).toEqual(
      moved('/sr/parts/bmw/3-series/'),
    );
  });
});

describe('withCatalogueRoutes', () => {
  const route = {
    src: '^/sr/parts/zz(?=/|$)/?(.*)$',
    headers: { Location: '/sr/parts/' },
    status: 301 as const,
  };

  it('puts the redirects just before the 404 catch-all', () => {
    const config = {
      version: 3,
      routes: [
        { src: '^/_astro/(.*)$', continue: true },
        { src: '/.*', dest: '/404.html', status: 404 },
      ],
    };

    expect(withCatalogueRoutes(config, [route]).routes).toEqual([
      config.routes[0],
      route,
      config.routes[1],
    ]);
  });

  it('appends them when the build has no 404 page', () => {
    expect(withCatalogueRoutes({ version: 3, routes: [] }, [route])).toEqual({
      version: 3,
      routes: [route],
    });
  });
});
