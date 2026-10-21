import type { SteeringSide } from '@podbor/catalog-contract';

import type { VinDecoder } from './decoder';

const MERCEDES_WMIS = new Set(['WDB', 'WDD', 'WDC', 'W1K', 'W1N']);
const STEERING_BY_CHARACTER: Record<string, SteeringSide> = {
  '1': 'left',
  '2': 'right',
};

export const mercedesBaumusterDecoder: VinDecoder = {
  name: 'mercedes-baumuster',
  version: 1,
  async decode(vin) {
    const wmi = vin.slice(0, 3);
    const baumuster = vin.slice(3, 9);
    const steering = STEERING_BY_CHARACTER[vin[9]];
    if (!MERCEDES_WMIS.has(wmi) || !/^\d{6}$/.test(baumuster) || !steering) {
      return null;
    }
    return {
      make: 'mercedes-benz',
      identifiers: [{ type: 'mercedes-baumuster', value: baumuster }],
      facts: { steering },
      raw: { wmi, baumuster, steering: vin[9] },
    };
  },
};
