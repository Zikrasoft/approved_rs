import { typeKey } from './bmw-type-key';
import type { VinDecoder } from './decoder';

const BMW_WMIS = new Set(['WBA', 'WBS', 'WBX', 'WBY', '5UX']);

export const bmwTypeCodeDecoder: VinDecoder = {
  name: 'bmw-type-code',
  version: 2,
  async decode(vin) {
    const wmi = vin.slice(0, 3);
    if (!BMW_WMIS.has(wmi)) return null;
    const typeCode = vin.slice(3, 7);
    const steering = typeKey(typeCode)?.steering;
    return {
      make: 'bmw',
      identifiers: [{ type: 'bmw-type-code', value: typeCode }],
      facts: steering ? { steering } : {},
      raw: { wmi, typeCode },
    };
  },
};
