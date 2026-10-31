import type { MedusaRequest } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

export const PUBLIC_ROUTE_PREFIXES = ['/store', '/auth'] as const;

export const PUBLIC_ROUTES = [
  'GET /store/catalogue-redirects',
  'GET /store/categories',
  'GET /store/fitments',
  'GET /store/offers',
  'GET /store/part-identifiers/:id/offers',
  'GET /store/part-pages',
  'GET /store/search',
  'GET /store/vehicles',
  'POST /store/vin-lookups',
  'POST /store/offer-carts',
  'POST /store/offer-carts/:id/items',
  'POST /store/offer-carts/:id/items/:item_id',
  'DELETE /store/offer-carts/:id/items/:item_id',
  'POST /store/offer-carts/:id/items/:item_id/addon',
  'DELETE /store/offer-carts/:id/items/:item_id/addon',
  'POST /store/offer-carts/:id/items/:item_id/installation',
  'DELETE /store/offer-carts/:id/items/:item_id/installation',
  'POST /store/offer-carts/:id/reprice',
  'POST /store/offer-carts/:id/complete',
  'POST /auth/session',
  'DELETE /auth/session',
  'POST /auth/token/refresh',
  'POST /auth/mfa/challenges/:id/verify',
  'GET /auth/mfa/factors',
  'POST /auth/mfa/factors',
  'POST /auth/mfa/factors/:id/verify',
  'DELETE /auth/mfa/factors/:id',
  'POST /auth/mfa/recovery-codes',
  'POST /auth/verification/request',
  'POST /auth/verification/confirm',
  'GET /auth/user/providers',
  'POST /auth/user/:auth_provider',
  'POST /auth/user/:auth_provider/register',
  'POST /auth/user/:auth_provider/reset-password',
  'POST /auth/user/:auth_provider/update',
] as const;

const routeMatchers = PUBLIC_ROUTES.map((route) => {
  const [method, path] = route.split(' ');
  const pattern = new RegExp(`^${path!.replace(/:\w+/g, '[^/]+')}/?$`);
  return (verb: string, url: string) => verb === method && pattern.test(url);
});

export const isPublicRoute = (method: string, url: string): boolean => {
  const [path = ''] = url.split('?');
  return (
    method === 'OPTIONS' ||
    routeMatchers.some((matches) => matches(method, path))
  );
};

export const refuseUnlistedRoute = (
  req: Pick<MedusaRequest, 'method' | 'originalUrl'>,
  _res: unknown,
  next: (error?: MedusaError) => void,
): void =>
  isPublicRoute(req.method, req.originalUrl)
    ? next()
    : next(new MedusaError(MedusaError.Types.NOT_FOUND, 'No such route'));
