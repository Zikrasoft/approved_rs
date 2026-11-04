import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import {
  REQUEST_ID_HEADER,
  requestIdSchema,
} from '@podbor/catalog-contract/events';
import type { AcceptedSecrets } from '@podbor/lead-crm/verify-secret';

import { publicRoute } from '../api/public-routes';
import { hashed, logEvent } from './log-event';
import { clientAddress, networkOf, storefrontSecrets } from './rate-limit';

type RoutedRequest = Pick<MedusaRequest, 'method' | 'originalUrl'> & {
  route?: { path?: unknown };
};

const failures = new WeakMap<object, string>();

export const noteFailure = (req: object, reason: string): void => {
  failures.set(req, reason);
};

export const routeOf = (req: RoutedRequest): string => {
  const matched = typeof req.route?.path === 'string' ? req.route.path : null;
  return (
    publicRoute(req.method, req.originalUrl) ??
    `${req.method} ${matched ?? 'unlisted'}`
  );
};

const outcomeOf = (status: number) =>
  status < 400 ? 'ok' : status < 500 ? 'refused' : 'failed';

export const observeRequests =
  (vouchers: AcceptedSecrets = storefrontSecrets()) =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction): void => {
    const started = performance.now();
    const requestId =
      requestIdSchema.safeParse(req.headers[REQUEST_ID_HEADER]).data ??
      randomUUID();
    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    res.on('finish', () => {
      logEvent(
        'store.request',
        {
          outcome: outcomeOf(res.statusCode),
          reason: failures.get(req) ?? null,
          method: req.method,
          route: routeOf(req),
          status: res.statusCode,
          duration_ms: Math.round(performance.now() - started),
          client: hashed('client', networkOf(clientAddress(req, vouchers))),
        },
        requestId,
      );
    });
    next();
  };
