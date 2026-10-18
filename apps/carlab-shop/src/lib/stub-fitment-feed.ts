import type { FitmentFeed, IncomingFitment } from './fitment-sync';

export const STUB_FITMENT_VENDOR = 'stub';

export const STUB_FITMENT_FEED_ROWS: IncomingFitment[] = [
  {
    partIdentifier: { type: 'oem', brand: 'ATE', value: 'STUB-OEM-1' },
    vehicleIdentifier: { type: 'ktype', value: 'STUB-KTYPE-1' },
    productionFrom: new Date('2015-01-01T00:00:00Z'),
    productionTo: new Date('2018-12-31T00:00:00Z'),
    steering: 'left',
    gearbox: 'manual',
  },
  {
    partIdentifier: { type: 'oem', brand: 'Bosch', value: 'STUB-OEM-2' },
    vehicleIdentifier: { type: 'ktype', value: 'STUB-KTYPE-2' },
    productionFrom: null,
    productionTo: null,
    steering: null,
    gearbox: null,
  },
  {
    partIdentifier: { type: 'oem', brand: 'Febi', value: 'STUB-OEM-3' },
    vehicleIdentifier: { type: 'ktype', value: 'STUB-KTYPE-3' },
    productionFrom: null,
    productionTo: null,
    steering: null,
    gearbox: null,
  },
];

export function createStubFitmentFeed(
  rows: IncomingFitment[] = STUB_FITMENT_FEED_ROWS,
): FitmentFeed {
  return {
    vendor: STUB_FITMENT_VENDOR,
    fetchRows: () => rows,
  };
}
