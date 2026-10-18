import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchVehicleParts,
  fetchVehicles,
  findVehicle,
  listEngines,
  listMakes,
  listModels,
  resolveVin,
  type Vehicle,
} from './vehiclePicker';

const BACKEND_URL = 'http://localhost:9009';
const PUBLISHABLE_KEY = 'pk_test';

const VEHICLES: Vehicle[] = [
  {
    id: 'vehicle_1',
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'B47',
    year_from: 2015,
    year_to: 2018,
  },
  {
    id: 'vehicle_2',
    make: 'BMW',
    model: '320d (F30)',
    engine_code: 'N47',
    year_from: 2010,
    year_to: 2012,
  },
  {
    id: 'vehicle_3',
    make: 'BMW',
    model: 'X3 (F25)',
    engine_code: 'N47',
    year_from: 2011,
    year_to: 2014,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchVehicles', () => {
  it('fetches and parses the vehicle list from the store API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vehicles: VEHICLES }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const vehicles = await fetchVehicles({
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(fetchMock).toHaveBeenCalledWith(`${BACKEND_URL}/store/vehicles`, {
      headers: { 'x-publishable-api-key': PUBLISHABLE_KEY },
    });
    expect(vehicles).toEqual(VEHICLES);
  });

  it('returns an empty list when the store API responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    const vehicles = await fetchVehicles({
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(vehicles).toEqual([]);
  });
});

describe('fetchVehicleParts', () => {
  it('fetches and parses the fitment-filtered part list', async () => {
    const parts = [
      {
        part: { id: 'part_1', name: 'Oil filter' },
        ambiguous: false,
        candidates: [
          {
            fitment_id: 'fit_1',
            production_from: null,
            production_to: null,
            steering: null,
            gearbox: null,
          },
        ],
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ parts }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchVehicleParts('vehicle_1', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/store/vehicles/vehicle_1/parts`,
      { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } },
    );
    expect(result).toEqual(parts);
  });

  it('returns null when the store API responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    const result = await fetchVehicleParts('missing', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(result).toBeNull();
  });
});

describe('resolveVin', () => {
  it('posts the VIN and returns the resolved vehicle', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resolved: true, vehicle: VEHICLES[0] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const vehicle = await resolveVin('WBA3B1C50GL123456', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(fetchMock).toHaveBeenCalledWith(`${BACKEND_URL}/store/vin-lookups`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-publishable-api-key': PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ vin: 'WBA3B1C50GL123456' }),
    });
    expect(vehicle).toEqual(VEHICLES[0]);
  });

  it('returns null when the VIN does not resolve', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ resolved: false, vehicle: null }),
      }),
    );

    const vehicle = await resolveVin('1HGCM82633A004352', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(vehicle).toBeNull();
  });

  it('returns null when the store API responds with a non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );

    const vehicle = await resolveVin('bad-vin', {
      backendUrl: BACKEND_URL,
      publishableKey: PUBLISHABLE_KEY,
    });

    expect(vehicle).toBeNull();
  });
});

describe('cascading picker helpers', () => {
  it('lists the distinct makes', () => {
    expect(listMakes(VEHICLES)).toEqual(['BMW']);
  });

  it('lists the distinct models for a make', () => {
    expect(listModels(VEHICLES, 'BMW')).toEqual(['320d (F30)', 'X3 (F25)']);
  });

  it('lists the distinct engines for a make+model', () => {
    expect(listEngines(VEHICLES, 'BMW', '320d (F30)')).toEqual(['B47', 'N47']);
  });

  it('finds the vehicle matching make+model+engine', () => {
    expect(findVehicle(VEHICLES, 'BMW', '320d (F30)', 'N47')).toEqual(
      VEHICLES[1],
    );
  });

  it('returns null when no vehicle matches', () => {
    expect(findVehicle(VEHICLES, 'BMW', '320d (F30)', 'B48')).toBeNull();
  });
});
