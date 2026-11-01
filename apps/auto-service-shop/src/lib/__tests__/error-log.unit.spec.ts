import { EventEmitter } from 'node:events';

import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../modules/_shared/admin-error';
import { keepAdminCodes } from '../admin-errors';
import { observeRequests } from '../request-log';

jest.mock('@sentry/node', () => ({ captureException: jest.fn() }));

const logged = () =>
  (console.log as jest.Mock).mock.calls.map(([line]) => JSON.parse(line));

const fail = (error: unknown) => {
  const req = {
    method: 'GET',
    originalUrl: '/store/search?q=x',
    headers: {},
    socket: { remoteAddress: '203.0.113.9' },
    scope: { resolve: () => ({ error: jest.fn(), info: jest.fn() }) },
  } as Record<string, unknown>;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headersSent: false,
    setHeader: jest.fn(),
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
  });
  observeRequests([])(req as never, res as never, jest.fn());
  keepAdminCodes(error as MedusaError, req as never, res as never, jest.fn());
  res.emit('finish');
  return req;
};

describe('the error handler logs', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a 5xx as store.error with its cause, under the request id', () => {
    const req = fail(
      Object.assign(new Error('search exploded'), {
        cause: new Error('typesense down'),
      }),
    );

    expect(logged()).toEqual([
      expect.objectContaining({
        event: 'store.error',
        request_id: req.requestId,
        outcome: 'failed',
        reason: 'unexpected',
        route: 'GET /store/search',
        status: 500,
        cause: 'Error: search exploded <- Error: typesense down',
      }),
      expect.objectContaining({
        event: 'store.request',
        outcome: 'failed',
        reason: 'unexpected',
        status: 500,
      }),
    ]);
  });

  it('a client error only on the request line, with its type as the reason', () => {
    fail(new MedusaError(MedusaError.Types.NOT_FOUND, 'no such part'));

    expect(logged()).toEqual([
      expect.objectContaining({
        event: 'store.request',
        outcome: 'refused',
        reason: 'not_found',
        status: 404,
      }),
    ]);
  });

  it('an admin code as the reason', () => {
    fail(
      adminError(MedusaError.Types.CONFLICT, 'CATALOGUE_BUSY', 'Another run'),
    );

    expect(logged()).toEqual([
      expect.objectContaining({
        event: 'store.request',
        reason: 'CATALOGUE_BUSY',
        status: 409,
      }),
    ]);
  });

  it('a 5xx outside an observed request with no request id', () => {
    const res = {
      statusCode: 200,
      headersSent: false,
      status: jest.fn(() => res),
      json: jest.fn(() => res),
      send: jest.fn(() => res),
    };

    keepAdminCodes(
      new Error('boom') as never,
      {
        method: 'POST',
        originalUrl: '/admin/parts',
        scope: { resolve: () => ({ error: jest.fn() }) },
      } as never,
      res as never,
      jest.fn(),
    );

    expect(logged()).toEqual([
      expect.objectContaining({
        event: 'store.error',
        request_id: null,
        route: 'POST unlisted',
      }),
    ]);
  });
});
