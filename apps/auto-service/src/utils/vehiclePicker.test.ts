import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchVehicleParts,
  fetchVehicles,
  findVehicle,
  listEngines,
  listMakes,
  listModels,
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
