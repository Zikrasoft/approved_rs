import { readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { HTTP_METHODS } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PUBLIC_ROUTE_PREFIXES, PUBLIC_ROUTES } from '../public-routes';

const routeFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(join(dir, entry.name))
      : /^route\.(js|ts)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

const registeredRoutes = (apiDir: string): string[] =>
  routeFiles(apiDir).flatMap((file) => {
    const path = `/${relative(apiDir, dirname(file))
      .split(sep)
      .map((segment) => segment.replace(/^\[(\w+)\]$/, ':$1'))
      .join('/')}`;
    const verbs = Object.keys(jest.requireActual(file)).filter((name) =>
      HTTP_METHODS.includes(name as (typeof HTTP_METHODS)[number]),
    );
    return PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(`${prefix}/`))
      ? verbs.map((verb) => `${verb} ${path}`)
      : [];
  });

const medusaApi = join(
  dirname(require.resolve('@medusajs/medusa/package.json')),
  'dist',
  'api',
);
const shopApi = join(__dirname, '..');
const stockRoutes = registeredRoutes(medusaApi);
const shopRoutes = registeredRoutes(shopApi);
const registered = [...new Set([...stockRoutes, ...shopRoutes])];
const isPublic = (route: string) =>
  (PUBLIC_ROUTES as readonly string[]).includes(route);
const asAdmin = (route: string) => route.replace(':actor_type', 'user');

medusaIntegrationTestRunner({
  moduleName: 'public-routes',
  dbName: 'medusa-public-routes',
  testSuite: ({ api, getContainer }) => {
    describe('public store and auth routes', () => {
      let publishable: string;

      beforeAll(async () => {
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        publishable = (
          await apiKeys.createApiKeys({
            title: 'public-routes-tests',
            type: 'publishable',
            created_by: 'test',
          })
        ).token;
      });

      const call = (route: string) => {
        const [method, path] = route.split(' ');
        return api
          .request({
            method,
            url: path!
              .replace(':actor_type', 'customer')
              .replace(/:\w+/g, 'probe'),
            headers: { 'x-publishable-api-key': publishable },
            ...(method !== 'GET' && method !== 'DELETE' && { data: {} }),
          })
          .catch((error) => error.response);
      };

      it('finds the routes Medusa and the shop register', () => {
        expect(stockRoutes).toContain('GET /store/orders/:id');
        expect(shopRoutes).toContain('POST /store/offer-carts');
      });

      it('lists only routes something registers', () => {
        const known = new Set([...registered, ...registered.map(asAdmin)]);
        expect(PUBLIC_ROUTES.filter((route) => !known.has(route))).toEqual([]);
      });

      it('lists every store route the shop serves', () => {
        expect(shopRoutes.filter((route) => !isPublic(route))).toEqual([]);
      });

      it('refuses every store and auth route it does not list', async () => {
        const answered: string[] = [];
        for (const route of registered.filter((route) => !isPublic(route))) {
          const { status, data } = await call(route);
          if (status !== 404 || data?.message !== 'No such route') {
            answered.push(`${route} → ${status}`);
          }
        }
        expect(answered).toEqual([]);
      });

      it('keeps an order out of reach of whoever holds its id', async () => {
        const { status, data } = await call('GET /store/orders/:id');
        expect([status, data.message]).toEqual([404, 'No such route']);
      });

      it('lets a listed route reach its handler', async () => {
        const { status } = await call('GET /store/categories');
        expect(status).toBe(200);
      });
    });
  },
});
