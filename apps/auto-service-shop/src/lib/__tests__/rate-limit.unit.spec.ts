import {
  clientAddress,
  networkOf,
  rateLimit,
  storefrontSecrets,
} from '../rate-limit';

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
    expect(
      clientAddress(request('172.18.0.4', '203.0.113.9') as never, []),
    ).toBe('203.0.113.9');
    expect(
      clientAddress(request('198.51.100.7', '203.0.113.9') as never, []),
    ).toBe('198.51.100.7');
  });
});

describe('the storefront visitor', () => {
  const storefront = '198.51.100.20';

  it('keys a storefront call on the visitor it vouches for with the shop secret', () => {
    expect(
      clientAddress(
        request(storefront, storefront, {
          'x-shop-client': '203.0.113.5',
          'x-shop-client-secret': STOREFRONT_SECRET,
        }) as never,
        [STOREFRONT_SECRET],
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
        clientAddress(request(storefront, storefront, headers) as never, [
          STOREFRONT_SECRET,
        ]),
      ).toBe(storefront);
    }
  });
});

describe('storefrontSecrets', () => {
  it('takes the client secret pair and, while storefronts move over, the lead secret pair', () => {
    expect(
      storefrontSecrets({
        SHOP_CLIENT_SECRET: 'client-new',
        SHOP_CLIENT_SECRET_PREVIOUS: 'client-old',
        SHOP_LEAD_SECRET: 'lead-new',
        SHOP_LEAD_SECRET_PREVIOUS: undefined,
      } as never),
    ).toEqual(['client-new', 'client-old', 'lead-new', undefined]);
  });
});

describe('networkOf', () => {
  it('keeps an IPv4 address whole', () => {
    expect(networkOf('203.0.113.5')).toBe('203.0.113.5');
    expect(networkOf('::ffff:203.0.113.5')).toBe('::ffff:cb00:7105');
  });

  it('keys an IPv6 address by its /64, however it is spelled', () => {
    const network = '2001:db8:1:1::/64';

    expect(networkOf('2001:db8:1:1::7')).toBe(network);
    expect(networkOf('2001:0DB8:0001:0001:aaaa:bbbb:cccc:dddd')).toBe(network);
    expect(networkOf('2001:db8:1:1:0:0:0:1%eth0')).toBe(network);
    expect(networkOf('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkOf('::1')).toBe('0:0:0:0::/64');
    expect(networkOf('2001:db8:1:2::')).toBe('2001:db8:1:2::/64');
  });

  it('leaves anything that is no address as it is', () => {
    expect(networkOf('')).toBe('');
  });
});

describe('rateLimit', () => {
  let clock: number;
  const limited = rateLimit({ limit: 2, windowMs: 60_000, now: () => clock });

  const call = (peer: string, limiter = limited) => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const next = jest.fn();
    limiter(request(peer) as never, res as never, next);
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

  it('counts every address of one IPv6 /64 as one client', () => {
    expect(call('2001:db8:1:1::1').passed).toBe(true);
    expect(call('2001:db8:1:1::2').passed).toBe(true);

    expect(call('2001:db8:1:1:ffff::3').passed).toBe(false);
    expect(call('2001:db8:1:2::1').passed).toBe(true);
  });

  it('keys a vouched storefront visitor by its network', () => {
    const vouched = rateLimit({
      limit: 1,
      windowMs: 60_000,
      now: () => clock,
      vouchers: [STOREFRONT_SECRET],
    });
    const visit = (visitor: string) => {
      const next = jest.fn();
      vouched(
        request('198.51.100.20', '198.51.100.20', {
          'x-shop-client': visitor,
          'x-shop-client-secret': STOREFRONT_SECRET,
        }) as never,
        {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
          setHeader: jest.fn(),
        } as never,
        next,
      );
      return next.mock.calls.length === 1;
    };

    expect(visit('2001:db8:5:5::1')).toBe(true);
    expect(visit('2001:db8:5:5::2')).toBe(false);
  });
});
