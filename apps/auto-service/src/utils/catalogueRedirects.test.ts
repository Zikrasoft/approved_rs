import { describe, expect, it } from 'vitest';
import {
  cataloguePlaceSchema,
  type CatalogueRedirect,
} from '@podbor/catalog-contract';
import {
  catalogueRoutes,
  carRoutes,
  type RedirectRoute,
  withCatalogueRoutes,
} from './catalogueRedirects';
import type { CataloguePages } from './paths';

const pagesOf = ({
  makes = [],
  models = [],
  categories = [],
  vehicles = [],
}: Partial<Record<keyof CataloguePages, string[]>>): CataloguePages => ({
  makes: new Set(makes),
  models: new Set(models),
  categories: new Set(categories),
  vehicles: new Set(vehicles),
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
  it('sends a car renamed by a Model merge to itself, not to the car that kept its slug', () => {
    const routes = catalogueRoutes(
      [
        redirect(
          { make: 'volkswagen', model: 'vw-golf' },
          { make: 'volkswagen', model: 'golf' },
        ),
        redirect(
          { make: 'volkswagen', model: 'vw-golf', vehicle: 'caxa-90kw' },
          { make: 'volkswagen', model: 'golf', vehicle: 'caxa-90kw-2' },
        ),
      ],
      pagesOf({
        makes: ['volkswagen'],
        models: ['volkswagen/golf'],
        vehicles: ['volkswagen/golf/caxa-90kw-2'],
      }),
    );

    expect(follow(routes, '/sr/parts/volkswagen/vw-golf/m/caxa-90kw/')).toEqual(
      moved('/sr/parts/volkswagen/golf/m/caxa-90kw-2/'),
    );
    expect(
      follow(routes, '/sr/parts/volkswagen/vw-golf/m/caxa-110kw/'),
    ).toEqual(moved('/sr/parts/volkswagen/golf/m/caxa-110kw/'));
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
    expect(follow(routes, '/en/parts/bmw-old/f30-320d/oil-filters/')).toEqual(
      moved('/en/parts/bmw/f30-320d/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw-oldtimer/')).toBeNull();
  });

  it('follows a Model renamed after its Make in two hops', () => {
    const routes = catalogueRoutes(
      [
        redirect({ make: 'bmw-old' }, { make: 'bmw' }),
        redirect(
          { make: 'bmw', model: 'f30-old' },
          { make: 'bmw', model: '3-series-f30-320d' },
        ),
      ],
      pagesOf({ makes: ['bmw'], models: ['bmw/3-series-f30-320d'] }),
    );

    const first = follow(routes, '/sr/parts/bmw-old/f30-old/oil-filters/');
    expect(first).toEqual(moved('/sr/parts/bmw/f30-old/oil-filters/'));
    expect(follow(routes, first!.location)).toEqual(
      moved('/sr/parts/bmw/3-series-f30-320d/oil-filters/'),
    );
  });

  it('301s a renamed Category, its listing pages and its pages under every Model', () => {
    const routes = catalogueRoutes(
      [redirect({ category: 'oil' }, { category: 'oil-filters' })],
      pagesOf({
        makes: ['bmw'],
        models: ['bmw/f30-320d'],
        categories: ['bmw/f30-320d/oil-filters'],
      }),
    );

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
    const routes = catalogueRoutes(
      [redirect({ brand: 'mann' }, { brand: 'mann-filter' })],
      pagesOf({}),
    );

    expect(follow(routes, '/sr/parts/p/mann-hu816x/')).toEqual(
      moved('/sr/parts/p/mann-filter-hu816x/'),
    );
    expect(follow(routes, '/sr/parts/p/mann-filter-hu816x/')).toBeNull();
  });

  it('falls back from a target without a page to its Model, its Make, then the parts index', () => {
    const routes = catalogueRoutes(
      [
        redirect(
          { make: 'bmw', model: 'f30-320d', vehicle: 'old-140kw' },
          { make: 'bmw', model: 'f30-320d', vehicle: 'b47d20o0-140kw' },
        ),
        redirect(
          { make: 'bmw', model: 'e90-old' },
          { make: 'bmw', model: 'e90' },
        ),
        redirect({ make: 'vw' }, { make: 'volkswagen' }),
      ],
      pagesOf({ makes: ['bmw'], models: ['bmw/f30-320d'] }),
    );

    expect(follow(routes, '/sr/parts/bmw/f30-320d/m/old-140kw/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/'),
    );
    expect(follow(routes, '/sr/parts/bmw/e90-old/oil-filters/')).toEqual(
      moved('/sr/parts/bmw/'),
    );
    expect(follow(routes, '/sr/parts/vw/golf/')).toEqual(moved('/sr/parts/'));
  });

  it('sends a renamed Category under a Model only from a Model page, to the Model page when it lacks the Category', () => {
    const routes = catalogueRoutes(
      [redirect({ category: 'oil' }, { category: 'oil-filters' })],
      pagesOf({
        makes: ['bmw'],
        models: ['bmw/f30-320d', 'bmw/g20-320d'],
        categories: ['bmw/f30-320d/oil-filters'],
      }),
    );

    expect(follow(routes, '/sr/parts/bmw/f30-320d/oil/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/oil-filters/'),
    );
    expect(follow(routes, '/sr/parts/bmw/g20-320d/oil/')).toEqual(
      moved('/sr/parts/bmw/g20-320d/'),
    );
    expect(follow(routes, '/sr/parts/bmw/e90-320d/oil/')).toBeNull();
  });

  it('sends a deleted part to its Category, a deleted Vehicle to its Model and a deleted Make to the parts index', () => {
    const routes = catalogueRoutes(
      [
        redirect({ part: 'mann-filter-w712' }, { category: 'oil-filters' }),
        redirect(
          { make: 'bmw', model: 'f30-320d', vehicle: 'b47d20o0-140kw' },
          { make: 'bmw', model: 'f30-320d' },
        ),
        redirect({ make: 'zz' }, {}),
        redirect({ category: 'gone' }, {}),
      ],
      pagesOf({ makes: ['bmw'], models: ['bmw/f30-320d'] }),
    );

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

describe('carRoutes', () => {
  const vehicle = (
    id: string,
    slug: string,
    model = 'f30-320d',
    make = 'bmw',
  ) => ({
    id,
    slug,
    model: { slug: model, chassis: { series: { make: { slug: make } } } },
  });

  it('301s an old car page to its Vehicle page, in every locale', () => {
    const routes = carRoutes(
      [vehicle('veh_01', 'b47d20o0-140kw')],
      pagesOf({
        makes: ['bmw'],
        models: ['bmw/f30-320d'],
        vehicles: ['bmw/f30-320d/b47d20o0-140kw'],
      }),
    );

    expect(follow(routes, '/sr/parts/car/veh_01/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/m/b47d20o0-140kw/'),
    );
    expect(follow(routes, '/en/parts/car/veh_01')).toEqual(
      moved('/en/parts/bmw/f30-320d/m/b47d20o0-140kw/'),
    );
    expect(follow(routes, '/ru/parts/car/veh_012/')).toBeNull();
  });

  it('301s an old car page without a Vehicle page to its Model, its Make, or the parts index', () => {
    const routes = carRoutes(
      [
        vehicle('veh_f30', 'b47d20o0-140kw'),
        vehicle('veh_e90', 'n47d20c-130kw', 'e90-320d'),
        vehicle('veh_zz', 'x-1kw', 'x', 'zz'),
      ],
      pagesOf({ makes: ['bmw'], models: ['bmw/f30-320d'] }),
    );

    expect(follow(routes, '/sr/parts/car/veh_f30/')).toEqual(
      moved('/sr/parts/bmw/f30-320d/'),
    );
    expect(follow(routes, '/sr/parts/car/veh_e90/')).toEqual(
      moved('/sr/parts/bmw/'),
    );
    expect(follow(routes, '/sr/parts/car/veh_zz/')).toEqual(
      moved('/sr/parts/'),
    );
  });
});
