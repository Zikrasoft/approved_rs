import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { APIContext } from 'astro';

const pending: Promise<unknown>[] = [];
const catalogue = {
  search: vi.fn(),
  viewCart: vi.fn(),
  addToCart: vi.fn(),
  setQuantity: vi.fn(),
  setAddon: vi.fn(),
  removeFromCart: vi.fn(),
  placeOrder: vi.fn(),
};
const shop: { catalogue: typeof catalogue | null } = { catalogue };
const crm = {
  notifyLead: vi.fn(async () => ({ stored: true, delivered: true })),
  failedCheckoutCapped: vi.fn(async () => true),
};

vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));
vi.mock('@/utils/catalogueEnv', async (original) => ({
  ...(await original<typeof import('@/utils/catalogueEnv')>()),
  catalogueFor: () => shop.catalogue,
}));
vi.mock('@/lib/crm', () => ({
  BRAND: 'CarLab',
  leadStore: { failedCheckoutCapped: crm.failedCheckoutCapped },
  notifyLead: crm.notifyLead,
}));

const BACKEND = 'https://api.carlab.test';
const VERCEL_ID = 'fra1::iad1::route-test-1';
const posted: Record<string, unknown>[] = [];

const events = async () => {
  await Promise.all(pending);
  return posted;
};

const context = (
  url: string,
  init: RequestInit = {},
  headers: Record<string, string> = {},
) => {
  const request = new Request(url, {
    ...init,
    headers: { 'x-vercel-id': VERCEL_ID, ...headers },
  });
  return {
    url: new URL(url),
    request,
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { location } }),
    cookies: { get: () => undefined },
  } as unknown as APIContext;
};

const json = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
});

const form = (fields: Record<string, string>) => ({
  method: 'POST',
  body: new URLSearchParams(fields),
});

beforeAll(async () => {
  await Promise.all([
    import('@/pages/api/search'),
    import('@/pages/api/search-count'),
    import('@/pages/api/cart'),
    import('@/pages/api/order'),
    import('@/pages/api/leads'),
    import('@/pages/api/csp-report'),
  ]);
}, 60_000);

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', BACKEND);
  vi.stubEnv('SHOP_EVENTS_SECRET', 'events-secret');
  process.env.SHOP_EVENTS_SECRET = 'events-secret';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(`${BACKEND}/hooks/storefront-events`);
      posted.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete process.env.SHOP_EVENTS_SECRET;
  posted.length = 0;
  pending.length = 0;
  shop.catalogue = catalogue;
  vi.clearAllMocks();
});

const found = (count: number) => ({
  results: [],
  cars: [],
  facets: [],
  count,
});

describe('/api/search', () => {
  const search = async (q: string) =>
    (await import('@/pages/api/search')).GET(
      context(
        `https://carlab.rs/api/search?q=${encodeURIComponent(q)}&locale=ru`,
      ),
    );

  it('reports a suggestion search with its count, under the Vercel id', async () => {
    catalogue.search.mockResolvedValue(found(4));

    expect((await search('hu816x')).status).toBe(200);

    expect(await events()).toEqual([
      {
        event: 'storefront.search',
        request_id: VERCEL_ID,
        route: 'suggest',
        intent: 'query',
        outcome: 'ok',
        results: 4,
        duration_ms: expect.any(Number),
      },
    ]);
  });

  it('reports a VIN as skipped and never sends it', async () => {
    await search('WBA35BG070N074158');

    const sent = await events();
    expect(sent).toEqual([
      expect.objectContaining({
        intent: 'vin',
        outcome: 'skipped',
        results: null,
      }),
    ]);
    expect(JSON.stringify(sent)).not.toContain('WBA35BG070N074158');
    expect(catalogue.search).not.toHaveBeenCalled();
  });

  it('reports a query too short to search, a site without a shop, and a shop that did not answer', async () => {
    await search('');
    shop.catalogue = null;
    await search('filter');
    shop.catalogue = catalogue;
    catalogue.search.mockResolvedValue(null);
    expect((await search('filter')).status).toBe(503);
    await (
      await import('@/pages/api/search')
    ).GET(context('https://carlab.rs/api/search?locale=ru'));

    expect(
      (await events()).map(({ intent, outcome }) => [intent, outcome]),
    ).toEqual([
      ['empty', 'skipped'],
      ['query', 'skipped'],
      ['query', 'unavailable'],
      ['empty', 'skipped'],
    ]);
  });
});

describe('/api/search-count', () => {
  const count = async (params: string) =>
    (await import('@/pages/api/search-count')).GET(
      context(`https://carlab.rs/api/search-count?${params}`),
    );

  it('reports a count, an unscoped call and a shop that did not answer', async () => {
    catalogue.search.mockResolvedValueOnce(found(12));
    await count('q=filter&locale=ru');
    await count('locale=ru');
    catalogue.search.mockResolvedValueOnce(null);
    await count('category=oil-filters&locale=ru');

    expect(
      (await events()).map(({ route, intent, outcome, results }) => [
        route,
        intent,
        outcome,
        results,
      ]),
    ).toEqual([
      ['count', 'query', 'ok', 12],
      ['count', 'empty', 'skipped', null],
      ['count', 'empty', 'unavailable', null],
    ]);
  });
});

describe('/api/cart', () => {
  const cart = () => import('@/pages/api/cart');

  it('reports each action with the outcome the shop gave', async () => {
    const { GET, POST, PATCH, PUT, DELETE } = await cart();
    catalogue.viewCart.mockResolvedValue({ kind: 'empty' });
    catalogue.addToCart.mockResolvedValue({
      kind: 'refused',
      code: 'OFFER_OUT_OF_STOCK',
      cartId: null,
    });
    catalogue.setAddon.mockResolvedValue(undefined);
    catalogue.removeFromCart.mockResolvedValue({ kind: 'empty' });

    await GET(context('https://carlab.rs/api/cart?id=cart_1'));
    await POST(
      context(
        'https://carlab.rs/api/cart',
        json({ cart_id: null, offer_id: 'offer_1' }),
      ),
    );
    await PATCH(
      context(
        'https://carlab.rs/api/cart',
        json({ cart_id: 'cart_1', item_id: 'item_1', quantity: 5000 }),
      ),
    );
    await PUT(
      context(
        'https://carlab.rs/api/cart',
        json({
          cart_id: 'cart_1',
          item_id: 'item_1',
          on: true,
          kind: 'service',
        }),
      ),
    );
    await DELETE(
      context(
        'https://carlab.rs/api/cart',
        json({ cart_id: 'cart_1', item_id: 'item_1' }),
      ),
    );
    expect(
      (await DELETE(context('https://carlab.rs/api/cart', json({})))).status,
    ).toBe(400);

    expect(
      (await events()).map(({ action, outcome, reason }) => [
        action,
        outcome,
        reason,
      ]),
    ).toEqual([
      ['view', 'empty', null],
      ['add', 'refused', 'OFFER_OUT_OF_STOCK'],
      ['quantity', 'refused', 'OFFER_OUT_OF_STOCK'],
      ['addon', 'inquiry', null],
      ['remove', 'empty', null],
      ['remove', 'invalid', null],
    ]);
  });

  it('reports a quantity the shop set and every malformed body as invalid', async () => {
    const { POST, PATCH, PUT } = await cart();
    catalogue.setQuantity.mockResolvedValue({ kind: 'cart', cart: {} });

    await PATCH(
      context(
        'https://carlab.rs/api/cart',
        json({ cart_id: 'cart_1', item_id: 'item_1', quantity: 2 }),
      ),
    );
    for (const route of [POST, PATCH, PUT]) {
      await route(context('https://carlab.rs/api/cart', json({ cart_id: 1 })));
    }

    expect(
      (await events()).map(({ action, outcome }) => [action, outcome]),
    ).toEqual([
      ['quantity', 'cart'],
      ['add', 'invalid'],
      ['quantity', 'invalid'],
      ['addon', 'invalid'],
    ]);
    expect(catalogue.setQuantity).toHaveBeenCalledWith('cart_1', 'item_1', 2);
  });

  it('reports nothing for a view without a cart id', async () => {
    const { GET } = await cart();

    await GET(context('https://carlab.rs/api/cart'));

    expect(await events()).toEqual([]);
  });
});

describe('/api/order', () => {
  const CONTACT = {
    contact: '+381601234567',
    contact_channel: 'phone',
    consent: '1',
    locale: 'ru',
  };
  const order = async (fields: Record<string, string>) =>
    (await import('@/pages/api/order')).POST(
      context('https://carlab.rs/api/order', form(fields), {
        origin: 'https://carlab.rs',
      }),
    );

  it('reports each checkout outcome without the contact', async () => {
    catalogue.placeOrder
      .mockResolvedValueOnce({
        kind: 'order',
        order: { id: 'order_1', display_id: 7 },
      })
      .mockResolvedValueOnce({ kind: 'refused', code: 'PRICE_CHANGED' })
      .mockResolvedValueOnce({ kind: 'empty' })
      .mockResolvedValueOnce(undefined);
    const cartFields = {
      ...CONTACT,
      cart_id: 'cart_1',
      cart_fingerprint: 'item_1:1:100',
    };

    await order(cartFields);
    await order(cartFields);
    await order(cartFields);
    await order(cartFields);
    await order({ ...CONTACT, consent: '' });
    await order({ ...CONTACT, contact: 'call me' });
    await order({ ...CONTACT, website: 'bot' });

    const sent = await events();
    expect(sent.map(({ outcome, reason }) => [outcome, reason])).toEqual([
      ['placed', null],
      ['refused', 'PRICE_CHANGED'],
      ['expired', null],
      ['unreachable', null],
      ['invalid', 'no_consent'],
      ['invalid', 'contact'],
      ['honeypot', null],
    ]);
    expect(JSON.stringify(sent)).not.toContain('381601234567');
  });

  it('reports a checkout without a readable cart as expired, and still keeps its Failed checkout Lead', async () => {
    crm.failedCheckoutCapped.mockResolvedValueOnce(false);

    await order(CONTACT);

    expect(
      (await events()).map(({ outcome, reason }) => [outcome, reason]),
    ).toEqual([['expired', null]]);
    expect(crm.notifyLead).toHaveBeenCalledTimes(1);
    expect(catalogue.placeOrder).not.toHaveBeenCalled();
  });
});

describe('/api/leads', () => {
  const lead = async (fields: Record<string, string>) =>
    (await import('@/pages/api/leads')).POST(
      context('https://carlab.rs/api/leads', form(fields), {
        origin: 'https://carlab.rs',
      }),
    );

  it('reports a form the route refused, and nothing for one it took', async () => {
    expect((await lead({ locale: 'ru' })).status).toBe(400);
    expect(
      (
        await lead({
          locale: 'ru',
          contact: '+381601234567',
          contact_channel: 'phone',
          consent: '1',
        })
      ).status,
    ).toBe(302);

    expect(await events()).toEqual([
      {
        event: 'storefront.lead',
        request_id: VERCEL_ID,
        source: 'leads',
        service: null,
        outcome: 'refused',
        reason: 'invalid_form',
      },
    ]);
  });

  it('names any other refusal by its status', async () => {
    expect(
      (
        await (
          await import('@/pages/api/leads')
        ).POST(
          context(
            'https://carlab.rs/api/leads',
            form({ comment: 'x'.repeat(70 * 1024) }),
          ),
        )
      ).status,
    ).toBe(413);

    expect(await events()).toEqual([
      expect.objectContaining({ outcome: 'refused', reason: 'status_413' }),
    ]);
  });
});

describe('/api/csp-report', () => {
  it('reports the directive and the blocked host only', async () => {
    const { POST } = await import('@/pages/api/csp-report');

    await POST(
      context(
        'https://carlab.rs/api/csp-report',
        {
          method: 'POST',
          body: JSON.stringify({
            'csp-report': {
              'effective-directive': 'script-src-elem',
              'blocked-uri': 'https://evil.example/x.js?phone=0641112233',
            },
          }),
        },
        { 'content-type': 'application/csp-report' },
      ),
    );

    expect(await events()).toEqual([
      {
        event: 'storefront.csp',
        request_id: null,
        directive: 'script-src-elem',
        blocked: 'evil.example',
      },
    ]);
  });
});
