import { describe, expect, it, vi } from 'vitest';
import { createCatalogue, partPagesForBuild } from './catalogue';
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
