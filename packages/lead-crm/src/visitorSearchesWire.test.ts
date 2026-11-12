import { describe, expect, it } from 'vitest';
import {
  visitorVinLookupsPath,
  visitorVinLookupsResponseSchema,
} from './visitorSearchesWire.ts';

const LOOKUP = {
  make: 'BMW',
  model: '118d E81',
  vin_last4: '1234',
  at: '2026-11-10T09:00:00.000Z',
  vehicle: null,
};

describe('the visitor VIN lookups wire', () => {
  it('names the hook of one visitor, escaped', () => {
    expect(visitorVinLookupsPath('a/b')).toBe(
      '/hooks/visitors/a%2Fb/vin-lookups',
    );
  });

  it('reads the lookups the shop sends', () => {
    expect(
      visitorVinLookupsResponseSchema.parse({ lookups: [LOOKUP] }),
    ).toEqual({ lookups: [LOOKUP] });
  });

  it('tolerates a shop ahead of or behind the CRM', () => {
    expect(
      visitorVinLookupsResponseSchema.parse({
        lookups: [
          { at: LOOKUP.at, extra: 1 },
          { make: 'BMW' },
          { ...LOOKUP, vehicle: 'BMW 1 E81 118d, N47D20' },
        ],
        next: null,
      }),
    ).toEqual({
      lookups: [
        {
          make: null,
          model: null,
          vin_last4: null,
          at: LOOKUP.at,
          vehicle: null,
        },
        { ...LOOKUP, vehicle: 'BMW 1 E81 118d, N47D20' },
      ],
    });
  });
});
