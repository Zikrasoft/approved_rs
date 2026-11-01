import { EventEmitter } from 'node:events';

import { noteFailure, observeRequests, routeOf } from '../request-log';

const logged = () =>
  (console.log as jest.Mock).mock.calls.map(([line]) => JSON.parse(line));

const exchange = (
  request: Partial<{
    method: string;
    originalUrl: string;
    headers: Record<string, string>;
    route: { path: string };
  }> = {},
) => {
  const req = {
    method: 'GET',
    originalUrl: '/store/search?q=WDB2110161A123456',
    headers: {},
    ip: '203.0.113.9',
    socket: { remoteAddress: '203.0.113.9' },
    ...request,
  } as Record<string, unknown>;
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    setHeader: jest.fn(),
  });
  const next = jest.fn();
  observeRequests([])(req as never, res as never, next);
  return { req, res, next };
};

describe('observeRequest', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs one store.request on finish, with the route pattern and no address or query', () => {
    const { req, res, next } = exchange();
    expect(next).toHaveBeenCalledWith();
    expect(console.log).not.toHaveBeenCalled();

    res.emit('finish');

    const [line] = logged();
    expect(line).toMatchObject({
      event: 'store.request',
      request_id: req.requestId,
      outcome: 'ok',
      reason: null,
      method: 'GET',
      route: 'GET /store/search',
      status: 200,
    });
    expect(line.duration_ms).toBeGreaterThanOrEqual(0);
    expect(line.client).toMatch(/^[0-9a-f]{12}$/);
    const text = JSON.stringify(line);
    expect(text).not.toContain('203.0.113.9');
    expect(text).not.toContain('WDB2110161A123456');
  });

  it('keeps a well-formed request id from the caller and answers with it', () => {
    const { req, res } = exchange({
      headers: { 'x-request-id': 'fra1::abc-123' },
    });

    expect(req.requestId).toBe('fra1::abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'fra1::abc-123');
  });

  it('makes its own id when the caller sends a malformed one', () => {
    const { req } = exchange({ headers: { 'x-request-id': 'no spaces' } });

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('tells a refusal from a failure and carries the noted reason', () => {
    const refused = exchange();
    refused.res.statusCode = 404;
    noteFailure(refused.req as never, 'not_found');
    refused.res.emit('finish');
    const failed = exchange();
    failed.res.statusCode = 503;
    failed.res.emit('finish');

    expect(logged().map(({ outcome, reason }) => [outcome, reason])).toEqual([
      ['refused', 'not_found'],
      ['failed', null],
    ]);
  });
});

describe('routeOf', () => {
  it('prefers the public route pattern, then the matched express path', () => {
    expect(
      routeOf({
        method: 'POST',
        originalUrl: '/store/offer-carts/cart_1/items',
      }),
    ).toBe('POST /store/offer-carts/:id/items');
    expect(
      routeOf({
        method: 'POST',
        originalUrl: '/hooks/carlab-orders/order_1/outcome',
        route: { path: '/hooks/carlab-orders/:id/outcome' },
      }),
    ).toBe('POST /hooks/carlab-orders/:id/outcome');
    expect(routeOf({ method: 'GET', originalUrl: '/store/nope' })).toBe(
      'GET unlisted',
    );
  });
});
