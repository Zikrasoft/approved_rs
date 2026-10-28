import type { VinDecoder } from './decoder';

const BMW_WMIS = new Set(['WBA', 'WBS', 'WBX', 'WBY', '5UX']);

export const bmwTypeCodeDecoder: VinDecoder = {
  name: 'bmw-type-code',
  version: 1,
  async decode(vin) {
    const wmi = vin.slice(0, 3);
    if (!BMW_WMIS.has(wmi)) return null;
    const typeCode = vin.slice(3, 7);
    return {
      make: 'bmw',
      identifiers: [{ type: 'bmw-type-code', value: typeCode }],
      facts: {},
      raw: { wmi, typeCode },
    };
  },
};
