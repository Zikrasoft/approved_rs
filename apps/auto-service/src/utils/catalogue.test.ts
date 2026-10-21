import { describe, expect, it, vi } from 'vitest';
import {
  catalogueFromEnv,
  createCatalogue,
  partPagesForBuild,
  vehiclesForBuild,
} from './catalogue';
import { PathBuilder } from './paths';
import { sitemapFilter } from './sitemap';

const BACKEND_URL = 'http://localhost:9009';

const mann = { name: 'Mann-Filter', slug: 'mann-filter' };
const bmw = { name: 'BMW', slug: 'bmw' };

const oilFilterMann = {
  id: 'pi_mann',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: mann,
  part: { id: 'part_oil', name: 'Oil filter', replaced_by: null },
  equivalents: [
    {
      id: 'pi_bmw',
      type: 'oem',
      value: '11 42 8575211',
      normalized_value: '11428575211',
      superseded: false,
      brand: bmw,
    },
  ],
  has_offers: false,
};

const oilFilterBmw = {
  id: 'pi_bmw',
  type: 'oem',
  value: '11 42 8575211',
  normalized_value: '11428575211',
  superseded: false,
  brand: bmw,
  part: { id: 'part_oil', name: 'Oil filter', replaced_by: null },
  equivalents: [
    {
      id: 'pi_mann',
      type: 'manufacturer-number',
      value: 'HU 816 x',
      normalized_value: 'HU816X',
      superseded: false,
      brand: mann,
    },
  ],
  has_offers: true,
};

const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 503, json: async () => body });

const catalogueWith = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: BACKEND_URL,
    publishableKey: 'pk_test',
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('catalogue.partPages', () => {
  it('lists a page per brand-number at the Brand slug and normalized number', async () => {
    const fetch = vi.fn(() =>
      respond({
        pages: [oilFilterMann, oilFilterBmw],
        count: 2,
        offset: 0,
        limit: 1000,
      }),
    );

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => page.slug)).toEqual([
      'mann-filter-hu816x',
      'bmw-11428575211',
    ]);
    expect(pages[0].equivalents).toEqual(oilFilterMann.equivalents);
    expect(fetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/part-pages?offset=0&limit=1000`,
      expect.objectContaining({
        headers: { 'x-publishable-api-key': 'pk_test' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('keeps every page noindex and out of the sitemap until it is enriched', async () => {
    const fetch = vi.fn(() =>
      respond({ pages: [oilFilterMann], count: 1, offset: 0, limit: 1000 }),
    );

    const [page] = await catalogueWith(fetch).partPages();
    const keep = sitemapFilter('https://carlab.rs');

    expect(page.indexable).toBe(false);
    expect(
      keep(`https://carlab.rs${PathBuilder.partNumber('sr', page.slug)}`),
    ).toBe(false);
  });

  it('asks for the price on a brand-number no supplier offers', async () => {
    const fetch = vi.fn(() =>
      respond({
        pages: [oilFilterMann, oilFilterBmw],
        count: 2,
        offset: 0,
        limit: 1000,
      }),
    );

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => [page.slug, page.priceOnRequest])).toEqual([
      ['mann-filter-hu816x', true],
      ['bmw-11428575211', false],
    ]);
  });

  it('pages through the backend until the count is reached', async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        respond({ pages: [oilFilterMann], count: 2, offset: 0, limit: 1 }),
      )
      .mockImplementationOnce(() =>
        respond({ pages: [oilFilterBmw], count: 2, offset: 1, limit: 1 }),
      );

    const pages = await catalogueWith(fetch).partPages();

    expect(pages).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(
      `${BACKEND_URL}/store/part-pages?offset=1&limit=1000`,
      expect.anything(),
    );
  });

  it('builds one page when two identifiers share a Brand and number', async () => {
    const ean = { ...oilFilterMann, id: 'pi_ean', type: 'ean' };
    const fetch = vi.fn(() =>
      respond({
        pages: [oilFilterMann, ean],
        count: 2,
        offset: 0,
        limit: 1000,
      }),
    );

    const pages = await catalogueWith(fetch).partPages();

    expect(pages.map((page) => page.id)).toEqual(['pi_mann']);
  });

  it('fails the build on a non-ok answer', async () => {
    const fetch = vi.fn(() => respond({}, false));

    await expect(catalogueWith(fetch).partPages()).rejects.toThrow('503');
  });

  it('fails the build on a body that breaks the contract', async () => {
    const fetch = vi.fn(() =>
      respond({ pages: [{ id: 'x' }], count: 1, offset: 0, limit: 1000 }),
    );

    await expect(catalogueWith(fetch).partPages()).rejects.toThrow();
  });
});

describe('partPagesForBuild', () => {
  it('builds no part pages when no backend is configured', async () => {
    expect(await partPagesForBuild({})).toEqual([]);
  });
});

const VEHICLE = {
  id: 'veh_1',
  power_kw: 140,
  drive: 'rwd',
  market: 'EU',
  year_from: 2015,
  year_to: 2019,
  steering: 'left',
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: {
      code: 'F30',
      body_style: 'sedan',
      series: {
        name: '3 серия',
        translations: { sr: 'Serija 3', en: '3 Series' },
        make: { slug: 'bmw', name: 'BMW' },
      },
    },
  },
  engine: {
    code: 'B47D20O0',
    family: 'B47',
    fuel: 'diesel',
    displacement_cc: 1995,
  },
  identifiers: [{ type: 'bmw-type-code', value: '35BG' }],
};

const VIN = 'WBA35BG070N074158';

const answer = (body: unknown, ok = true) => vi.fn(() => respond(body, ok));

const catalog = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: 'http://shop.test',
    publishableKey: 'pk_test',
    timeoutMs: 50,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('catalogue.vehicles', () => {
  it('lists the Vehicles the car pages are built from', async () => {
    const fetch = answer({ vehicles: [VEHICLE] });

    expect(await catalog(fetch).vehicles()).toEqual([VEHICLE]);
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/vehicles',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-publishable-api-key': 'pk_test',
        }),
      }),
    );
  });

  it('fails the build when the backend answers with an error', async () => {
    await expect(catalog(answer({}, false)).vehicles()).rejects.toThrow(
      '/store/vehicles answered 503',
    );
  });

  it('fails the build on a body that breaks the contract', async () => {
    await expect(
      catalog(answer({ vehicles: [{ id: 'veh_1' }] })).vehicles(),
    ).rejects.toThrow();
  });
});

describe('vehiclesForBuild', () => {
  it('builds no car pages when no backend is configured', async () => {
    expect(await vehiclesForBuild({})).toEqual([]);
  });
});

describe('catalogueFromEnv', () => {
  it('builds a catalogue for a configured backend without a publishable key', () => {
    expect(
      catalogueFromEnv({ MEDUSA_BACKEND_URL: 'http://shop.test' }),
    ).not.toBeNull();
  });
});

describe('catalogue.resolveVin', () => {
  it('lands on the car page for a resolved VIN', async () => {
    const fetch = answer({ resolved: true, vehicle: VEHICLE, facts: {} });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'vehicle',
      vehicle: VEHICLE,
      facts: {},
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/vin-lookups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ vin: VIN }),
      }),
    );
  });

  it('falls back to the inquiry for an unresolved VIN', async () => {
    const fetch = answer({ resolved: false, make: 'bmw', code: '99ZZ' });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend answers with an error', async () => {
    expect(await catalog(answer({}, false)).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the body breaks the contract', async () => {
    const fetch = answer({ resolved: true, vehicle: { id: 'veh_1' } });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend is unreachable', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend does not answer in time', async () => {
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });
});
