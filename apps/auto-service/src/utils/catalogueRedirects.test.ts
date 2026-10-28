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
  it('301s every page under a renamed Make, in every locale', () => {
    const routes = catalogueRoutes([
      redirect({ make: 'bmw-old' }, { make: 'bmw' }),
    ]);

    expect(follow(routes, '/sr/parts/bmw-old/')).toEqual(
      moved('/sr/parts/bmw/'),
    );
    expect(follow(routes, '/ru/parts/bmw-old')).toEqual(
      moved('/ru/parts/bmw/'),
    );
    expect(follow(routes, '/en/parts/bmw-old/f30-320d/oil-filters/')).toEqual(
      moved('/en/parts/bmw/f30-320d/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw-oldtimer/')).toBeNull();
  });

  it('follows a Model renamed after its Make in two hops', () => {
    const routes = catalogueRoutes([
      redirect({ make: 'bmw-old' }, { make: 'bmw' }),
      redirect(
        { make: 'bmw', model: 'f30-old' },
        { make: 'bmw', model: '3-series-f30-320d' },
      ),
    ]);

    const first = follow(routes, '/sr/parts/bmw-old/f30-old/oil-filters/');
    expect(first).toEqual(moved('/sr/parts/bmw/f30-old/oil-filters/'));
    expect(follow(routes, first!.location)).toEqual(
      moved('/sr/parts/bmw/3-series-f30-320d/oil-filters/'),
    );
  });

  it('301s a renamed Category, its listing pages and its pages under every Model', () => {
    const routes = catalogueRoutes([
      redirect({ category: 'oil' }, { category: 'oil-filters' }),
    ]);

    expect(follow(routes, '/sr/parts/c/oil/')).toEqual(
      moved('/sr/parts/c/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/c/oil/3/')).toEqual(
      moved('/sr/parts/c/oil-filters/3/'),
    );
    expect(follow(routes, '/sr/parts/bmw/f30-320d/oil/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw/f30-320d/oil-filters/')).toBeNull();
  });

  it('301s each part page of a renamed Brand without touching a Brand that shares its start', () => {
    const routes = catalogueRoutes([
      redirect({ brand: 'mann' }, { brand: 'mann-filter' }),
    ]);

    expect(follow(routes, '/sr/parts/p/mann-hu816x/')).toEqual(
      moved('/sr/parts/p/mann-filter-hu816x/'),
    );
    expect(follow(routes, '/sr/parts/p/mann-filter-hu816x/')).toBeNull();
  });

  it('sends a deleted part to its Category, a deleted Vehicle to its Model and a deleted Make to the parts index', () => {
    const routes = catalogueRoutes([
      redirect({ part: 'mann-filter-w712' }, { category: 'oil-filters' }),
      redirect(
        { make: 'bmw', model: 'f30-320d', vehicle: 'b47d20o0-140kw' },
        { make: 'bmw', model: 'f30-320d' },
      ),
      redirect({ make: 'zz' }, {}),
      redirect({ category: 'gone' }, {}),
    ]);

    expect(follow(routes, '/sr/parts/p/mann-filter-w712/')).toEqual(
      moved('/sr/parts/c/oil-filters/'),
    );
    expect(follow(routes, '/en/parts/bmw/f30-320d/m/b47d20o0-140kw/')).toEqual(
      moved('/en/parts/bmw/f30-320d/'),
    );
    expect(follow(routes, '/ru/parts/zz/x5/')).toEqual(moved('/ru/parts/'));
    expect(follow(routes, '/sr/parts/bmw/f30-320d/gone/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/'),
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
