import { afterEach, describe, expect, it, vi } from 'vitest';
import { APPROVED, CARLAB, DETAILS } from '@podbor/brands';
import { createVisitorSearches } from './visitorSearches.ts';

const VISITOR = '0f8fad5b-d9cb-469f-a165-70867728950e';
const LOOKUP = {
  make: 'BMW',
  model: '116d E81',
  vin_last4: '1234',
  at: '2026-11-10T09:00:00.000Z',
  vehicle: null,
};
const SHOP = { shopUrl: 'https://api.carlab.test', secret: 's3cret' };
const carlabLead = (visitorId: string | null) => ({
  brand: CARLAB.name,
  visitorId,
});

const answering = (response: Response | Error) => {
  const fetch = vi.fn(async (_url: URL, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createVisitorSearches', () => {
  it('asks the shop for the visitor VIN lookups with the shop secret', async () => {
    const fetch = answering(Response.json({ lookups: [LOOKUP] }));

    expect(await createVisitorSearches(SHOP)(carlabLead(VISITOR))).toEqual([
      LOOKUP,
    ]);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(
      `https://api.carlab.test/hooks/visitors/${VISITOR}/vin-lookups`,
    );
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer s3cret',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['no shop', { secret: 's3cret' }, VISITOR],
    ['no secret', { shopUrl: SHOP.shopUrl }, VISITOR],
    ['no visitor id', SHOP, null],
    ['a visitor id that is not one', SHOP, 'not-a-visitor'],
  ])('asks nobody with %s', async (_name, config, visitorId) => {
    const fetch = answering(Response.json({ lookups: [LOOKUP] }));

    expect(await createVisitorSearches(config)(carlabLead(visitorId))).toEqual(
      [],
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([APPROVED.name, DETAILS.name])(
    'never asks the shop about a %s Lead',
    async (brand) => {
      const fetch = answering(Response.json({ lookups: [LOOKUP] }));

      expect(
        await createVisitorSearches(SHOP)({ brand, visitorId: VISITOR }),
      ).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a refusal', new Response(null, { status: 401 })],
    ['a body that is not the wire', Response.json({ nope: true })],
    ['a network failure', new Error('ECONNRESET')],
  ])('gives no lookups and logs on %s', async (_name, response) => {
    answering(response);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await createVisitorSearches(SHOP)(carlabLead(VISITOR))).toEqual([]);
    expect(logged).toHaveBeenCalledWith(
      '[lead-crm] the shop gave no VIN searches for a Lead',
      expect.any(Object),
    );
  });
});
