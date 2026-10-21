import { describe, expect, it, vi } from 'vitest';
import {
  catalogueFromEnv,
  createCatalogue,
  vehiclesForBuild,
} from './catalogue';

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

const respond = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body });

const catalog = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: 'http://shop.test',
    publishableKey: 'pk_test',
    timeoutMs: 50,
    fetch,
  });

describe('vehicles', () => {
  it('lists the Vehicles the car pages are built from', async () => {
    const fetch = respond({ vehicles: [VEHICLE] });

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
    await expect(catalog(respond({}, false)).vehicles()).rejects.toThrow();
  });

  it('builds no car pages when no backend is configured', async () => {
    expect(await vehiclesForBuild({})).toEqual([]);
  });
});

describe('resolveVin', () => {
  it('lands on the car page for a resolved VIN', async () => {
    const fetch = respond({ resolved: true, vehicle: VEHICLE, facts: {} });

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
    const fetch = respond({ resolved: false, make: 'bmw', code: '99ZZ' });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the backend answers with an error', async () => {
    expect(await catalog(respond({}, false)).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when the body breaks the contract', async () => {
    const fetch = respond({ resolved: true, vehicle: { id: 'veh_1' } });

    expect(await catalog(fetch).resolveVin(VIN)).toEqual({
      kind: 'inquiry',
      vin: VIN,
    });
  });

  it('falls back to the inquiry when no backend is configured', async () => {
    expect(await catalogueFromEnv({}).resolveVin(VIN)).toEqual({
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
