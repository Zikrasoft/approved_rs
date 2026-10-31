import { clientAddress, rateLimit } from '../rate-limit';

const request = (
  peer: string,
  forwarded = peer,
  headers: Record<string, string> = {},
) => ({
  ip: forwarded,
  socket: { remoteAddress: peer },
  headers,
});

const STOREFRONT_SECRET = 'storefront-secret-0123456789abcdef';

describe('clientAddress', () => {
  it('trusts the forwarded address only from a proxy on a private network', () => {
    expect(clientAddress(request('172.18.0.4', '203.0.113.9') as never)).toBe(
      '203.0.113.9',
    );
    expect(clientAddress(request('198.51.100.7', '203.0.113.9') as never)).toBe(
      '198.51.100.7',
    );
  });
});

describe('the storefront visitor', () => {
  const storefront = '198.51.100.20';

  beforeEach(() => {
    process.env.SHOP_LEAD_SECRET = STOREFRONT_SECRET;
  });

  afterEach(() => {
    delete process.env.SHOP_LEAD_SECRET;
  });

  it('keys a storefront call on the visitor it vouches for with the shop secret', () => {
    expect(
      clientAddress(
        request(storefront, storefront, {
          'x-shop-client': '203.0.113.5',
          'x-shop-client-secret': STOREFRONT_SECRET,
        }) as never,
      ),
    ).toBe('203.0.113.5');
  });

  it('ignores a visitor header without the secret, with a wrong one, or that is no address', () => {
    for (const headers of <Record<string, string>[]>[
      { 'x-shop-client': '203.0.113.5' },
      { 'x-shop-client': '203.0.113.5', 'x-shop-client-secret': 'guess' },
      {
        'x-shop-client': 'everyone',
        'x-shop-client-secret': STOREFRONT_SECRET,
      },
    ]) {
      expect(
        clientAddress(request(storefront, storefront, headers) as never),
      ).toBe(storefront);
    }
  });
});

describe('rateLimit', () => {
  let clock: number;
  const limited = rateLimit({ limit: 2, windowMs: 60_000, now: () => clock });

  const call = (peer: string) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const next = jest.fn();
    limited(request(peer) as never, res as never, next);
    return { res, passed: next.mock.calls.length === 1 };
  };

  beforeEach(() => {
    clock = 1_000_000;
  });

  it('lets a client through up to the limit, then answers 429 until the window slides', () => {
    expect(call('198.51.100.1').passed).toBe(true);
    clock += 10_000;
    expect(call('198.51.100.1').passed).toBe(true);
    const refused = call('198.51.100.1');
    const other = call('198.51.100.2');
    clock += 50_001;
    const afterFirstExpires = call('198.51.100.1');

    expect(refused.passed).toBe(false);
    expect(refused.res.status).toHaveBeenCalledWith(429);
    expect(refused.res.setHeader).toHaveBeenCalledWith('Retry-After', '50');
    expect(other.passed).toBe(true);
    expect(afterFirstExpires.passed).toBe(true);
  });
});
