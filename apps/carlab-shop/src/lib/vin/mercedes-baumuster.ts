import type { SteeringSide } from '@podbor/catalog-contract';

import type { VinDecoder } from './decoder';

const MERCEDES_WMIS = new Set(['WDB', 'WDD', 'WDC', 'W1K', 'W1N']);
const STEERING_BY_CHARACTER: Record<string, SteeringSide> = {
  '1': 'left',
  '2': 'right',
};

export const mercedesBaumusterDecoder: VinDecoder = {
  name: 'mercedes-baumuster',
  version: 2,
  async decode(vin) {
    const wmi = vin.slice(0, 3);
    if (!MERCEDES_WMIS.has(wmi)) {
      return null;
    }
    const baumuster = vin.slice(3, 9);
    const steering = STEERING_BY_CHARACTER[vin[9]];
    if (!/^\d{6}$/.test(baumuster) || !steering) {
      const code = vin.slice(3, 8);
      return {
        make: 'mercedes-benz',
        identifiers: [],
        code,
        facts: {},
        raw: { wmi, code },
      };
    }
    return {
      make: 'mercedes-benz',
      identifiers: [{ type: 'mercedes-baumuster', value: baumuster }],
      facts: { steering },
      raw: { wmi, baumuster, steering: vin[9] },
    };
  },
};
