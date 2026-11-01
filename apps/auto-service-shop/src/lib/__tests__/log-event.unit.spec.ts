import {
  causeOf,
  hashed,
  loggedQuery,
  logEvent,
  logStorefrontEvent,
  vinFields,
} from '../log-event';

const lines = () =>
  (console.log as jest.Mock).mock.calls.map(([line]) => JSON.parse(line));

describe('logEvent', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('writes one JSON line led by the event name, the time and the request id', () => {
    logEvent(
      'search',
      {
        outcome: 'empty',
        intent: 'number',
        results: 0,
        zero: true,
        query: 'hu816x',
        category: null,
        scoped: false,
      },
      'req-1',
    );

    expect(console.log).toHaveBeenCalledTimes(1);
    const [line] = (console.log as jest.Mock).mock.calls[0];
    expect(Object.keys(JSON.parse(line)).slice(0, 4)).toEqual([
      'event',
      'at',
      'request_id',
      'outcome',
    ]);
    expect(lines()).toEqual([
      {
        event: 'search',
        at: '2026-11-01T10:00:00.000Z',
        request_id: 'req-1',
        outcome: 'empty',
        intent: 'number',
        results: 0,
        zero: true,
        query: 'hu816x',
        category: null,
        scoped: false,
      },
    ]);
  });

  it('logs a null request id outside a request', () => {
    logEvent('catalogue.run', {
      outcome: 'succeeded',
      reason: null,
      kind: 'import',
      run: 'run_1',
      supplier: null,
      duration_ms: 5,
      cause: null,
      counts: {},
    });

    expect(lines()[0].request_id).toBeNull();
  });

  it('logs a storefront event under its own request id, else the shop one', () => {
    logStorefrontEvent(
      {
        event: 'storefront.checkout',
        request_id: 'fra1::abc',
        outcome: 'placed',
        reason: null,
      },
      'shop-1',
    );
    logStorefrontEvent(
      {
        event: 'storefront.csp',
        request_id: null,
        directive: 'img-src',
        blocked: 'x.test',
      },
      'shop-2',
    );

    expect(lines().map(({ event, request_id }) => [event, request_id])).toEqual(
      [
        ['storefront.checkout', 'fra1::abc'],
        ['storefront.csp', 'shop-2'],
      ],
    );
  });

  it('never lets a logging failure reach the caller', () => {
    (console.log as jest.Mock).mockImplementation(() => {
      throw new Error('EPIPE');
    });

    expect(() =>
      logEvent('storefront.csp', { directive: 'img-src', blocked: 'x.test' }),
    ).not.toThrow();
  });
});

describe('hashed', () => {
  afterEach(() => {
    delete process.env.COOKIE_SECRET;
  });

  it('is a short keyed hash: stable for one key, different for another', () => {
    process.env.COOKIE_SECRET = 'a'.repeat(32);
    const first = hashed('client', '203.0.113.7');

    expect(first).toMatch(/^[0-9a-f]{12}$/);
    expect(hashed('client', '203.0.113.7')).toBe(first);
    expect(hashed('vin', '203.0.113.7')).not.toBe(first);

    process.env.COOKIE_SECRET = 'b'.repeat(32);
    expect(hashed('client', '203.0.113.7')).not.toBe(first);
  });
});

describe('vinFields', () => {
  it('keeps the maker prefix and a hash, never the VIN', () => {
    const fields = vinFields('WDB2110161A123456');

    expect(fields.wmi).toBe('WDB');
    expect(fields.vin).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(fields)).not.toContain('123456');
  });
});

describe('causeOf', () => {
  it('names the error and follows its cause', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED'), {
      name: 'SystemError',
    });

    expect(
      causeOf(Object.assign(new TypeError('fetch failed'), { cause })),
    ).toBe('TypeError: fetch failed <- SystemError: connect ECONNREFUSED');
  });

  it('names the type of a thrown non-error and caps a long chain', () => {
    expect(causeOf('boom')).toBe('string');
    expect(causeOf(new Error('x'.repeat(900)))).toHaveLength(500);
  });
});

describe('loggedQuery', () => {
  it.each([
    ['  HU 816  X ', 'hu 816 x'],
    ['filter ulja golf 5', 'filter ulja golf 5'],
    ['x'.repeat(80), 'x'.repeat(64)],
  ])('keeps %j as %j', (query, logged) => {
    expect(loggedQuery(query)).toBe(logged);
  });

  it.each([
    '',
    '   ',
    'WDB2110161A123456',
    'vin WDB2110161A123456 brakes',
    'petar@example.com',
    '+381 60 1234567',
    '060 123 4567',
  ])('drops %j', (query) => {
    expect(loggedQuery(query)).toBeNull();
  });
});
