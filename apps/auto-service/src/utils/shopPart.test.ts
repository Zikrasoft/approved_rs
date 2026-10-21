import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchShopPart, formatLeadTime } from './shopPart';

const BACKEND_URL = 'http://localhost:9009';
const PUBLISHABLE_KEY = 'pk_test';

const PART_BODY = {
  part: {
    id: 'part_1',
    name: 'Oil filter, BMW B47/B48 engines',
    identifiers: [
      {
        id: 'ident_1',
        type: 'oem',
        brand: 'BMW',
        value: '11 42 8575211',
        offers: [
          {
            id: 'offer_1',
            supplier: 'Intercars',
            supplier_article_id: 'IC-11428575211',
            price: 1850,
            stock_quantity: 12,
            lead_time: 'in_stock',
          },
        ],
      },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchShopPart', () => {
  it('fetches and parses the part from the store API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => PART_BODY,
    });
    vi.stubGlobal('fetch', fetchMock);

    const part = await fetchShopPart('part_1', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/parts/part_1`,
      { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } },
    );
    expect(part).toEqual(PART_BODY.part);
  });

  it('returns null when the store API responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    const part = await fetchShopPart('missing', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(part).toBeNull();
  });

  it('throws when the store API responds with a malformed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    await expect(
      fetchShopPart('part_1', {
        backendUrl: BACKEND_URL,
        publishableKey: PUBLISHABLE_KEY,
      }),
    ).rejects.toThrow();
  });
});

describe('formatLeadTime', () => {
  const copy = { inStock: 'В наличии', daysTemplate: '{days} дн.' };

  it('returns the in-stock label', () => {
    expect(formatLeadTime('in_stock', copy)).toBe('В наличии');
  });

  it('formats an N_days tier', () => {
    expect(formatLeadTime('3_days', copy)).toBe('3 дн.');
  });

  it('falls back to the raw value for an unrecognized tier', () => {
    expect(formatLeadTime('special-order', copy)).toBe('special-order');
  });
});
