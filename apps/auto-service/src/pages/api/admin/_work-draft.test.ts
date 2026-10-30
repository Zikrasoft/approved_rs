import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { parse } from 'yaml';
import { POST } from './work-draft';

const SHOP = 'http://shop.test';
const REPO = 'https://api.github.com/repos/Zikrasoft/approved_rs';
const DRAFT = 'apps/auto-service/src/content/works/parts-sourcing-42/index.md';

const summary = {
  display_id: 42,
  car: { make: 'BMW', model: '3 серия F30 320d', year: 2016 },
  parts: [
    { brand: 'MANN-FILTER', number: 'HU 816 x' },
    { brand: 'BOSCH', number: '0 242 236 562' },
  ],
  total_rsd: 9800,
};

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let shopAnswer: Response;
let draftExists = false;
let tokenCanPush = true;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const network = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
  const url = String(input);
  calls.push({ url, init });
  if (url.startsWith(SHOP)) return shopAnswer.clone();
  if (url === REPO)
    return tokenCanPush
      ? json({ permissions: { push: true } })
      : new Response('Bad credentials', { status: 401 });
  if (url.startsWith(`${REPO}/contents/`))
    return draftExists
      ? json({ content: Buffer.from('---\n---\n').toString('base64') })
      : new Response('Not Found', { status: 404 });
  if (url.endsWith('/git/ref/heads/main'))
    return json({ object: { sha: 'base-commit' } });
  if (url.endsWith('/git/commits/base-commit'))
    return json({ tree: { sha: 'base-tree' } });
  if (url.endsWith('/git/trees')) return json({ sha: 'new-tree' });
  if (url.endsWith('/git/commits')) return json({ sha: 'new-commit' });
  if (url.endsWith('/git/refs/heads/main')) return json({});
  throw new Error(`unexpected fetch ${url}`);
});

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', SHOP);
  vi.stubEnv('SHOP_LEAD_SECRET', 'shop-lead-secret');
  vi.stubGlobal('fetch', network);
  shopAnswer = json({ summary });
  draftExists = false;
  tokenCanPush = true;
  calls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const draft = (order: string, token?: string) => {
  const form = new FormData();
  form.set('order', order);
  return POST({
    request: new Request('http://localhost/api/admin/work-draft', {
      method: 'POST',
      body: form,
    }),
    cookies: {
      get: (name: string) =>
        token && name === 'keystatic-gh-access-token'
          ? { value: token }
          : undefined,
    },
  } as unknown as APIContext);
};

const committedFile = () => {
  const tree = calls.find(({ url }) => url.endsWith('/git/trees'));
  const body = JSON.parse(String(tree?.init.body));
  return body.tree as { path: string; content: string }[];
};

describe('POST /api/admin/work-draft', () => {
  it('commits one unpublished Parts sourcing Work with the car, the Parts and the total', async () => {
    const response = await draft('order_01', 'staff-token');

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/keystatic/branch/main/collection/works/item/parts-sourcing-42',
    );
    const files = committedFile();
    expect(files.map(({ path }) => path)).toEqual([DRAFT]);
    const [, frontmatter] = files[0].content.split('---\n');
    expect(parse(frontmatter)).toEqual({
      title: 'Подбор запчастей: BMW 3 серия F30 320d',
      car: 'BMW 3 серия F30 320d',
      year: 2016,
      servicesApplied: ['vin-parts-inquiry'],
      parts: summary.parts,
      priceRsd: 9800,
      gallery: [],
      date: new Date().toISOString().slice(0, 10),
      published: false,
    });
  });

  it('commits with the caller’s Keystatic login and asks the shop with the site’s secret', async () => {
    await draft('order_01', 'staff-token');

    const shop = calls.find(({ url }) => url.startsWith(SHOP));
    expect(shop?.url).toBe(`${SHOP}/hooks/carlab-orders/order_01/case-summary`);
    expect(new Headers(shop?.init.headers).get('authorization')).toBe(
      'Bearer shop-lead-secret',
    );
    const github = calls.filter(({ url }) => url.startsWith(REPO));
    expect(github.length).toBeGreaterThan(0);
    for (const { init } of github) {
      expect(new Headers(init.headers).get('authorization')).toBe(
        'Bearer staff-token',
      );
    }
  });

  it('refuses without a Keystatic login and touches neither the shop nor GitHub', async () => {
    const response = await draft('order_01');

    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('drafts a car-less Order without a car, a year or a price', async () => {
    shopAnswer = json({
      summary: { display_id: 42, car: null, parts: [], total_rsd: null },
    });

    await draft('order_01', 'staff-token');

    const [, frontmatter] = committedFile()[0].content.split('---\n');
    expect(parse(frontmatter)).toMatchObject({
      title: 'Подбор запчастей',
      car: '',
    });
    expect(parse(frontmatter)).not.toHaveProperty('year');
    expect(parse(frontmatter)).not.toHaveProperty('priceRsd');
  });

  it('opens the existing draft instead of copying the Order twice', async () => {
    draftExists = true;

    const response = await draft('order_01', 'staff-token');

    expect(response.headers.get('location')).toBe(
      '/keystatic/branch/main/collection/works/item/parts-sourcing-42',
    );
    expect(calls.some(({ url }) => url.endsWith('/git/trees'))).toBe(false);
  });

  it('refuses a cookie GitHub does not accept and asks the shop nothing', async () => {
    tokenCanPush = false;

    const response = await draft('order_01', 'forged-token');

    expect(response.status).toBe(401);
    expect(calls.some(({ url }) => url.startsWith(SHOP))).toBe(false);
    expect(calls.some(({ url }) => url.endsWith('/git/trees'))).toBe(false);
  });

  it('answers the shop refusing an Order with its own words, not the shop’s', async () => {
    shopAnswer = json(
      { message: 'Order order_01 is pending, not completed' },
      409,
    );

    const response = await draft('order_01', 'staff-token');

    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain('pending');
    expect(calls.some(({ url }) => url.endsWith('/git/trees'))).toBe(false);
  });

  it('fails loudly without the shop secret instead of sending an empty one', async () => {
    vi.stubEnv('SHOP_LEAD_SECRET', '');

    await expect(draft('order_01', 'staff-token')).rejects.toThrow(
      /SHOP_LEAD_SECRET/,
    );
    expect(calls.some(({ url }) => url.startsWith(SHOP))).toBe(false);
  });

  it('refuses an order id that is not one', async () => {
    const response = await draft('../admin', 'staff-token');

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });
});
