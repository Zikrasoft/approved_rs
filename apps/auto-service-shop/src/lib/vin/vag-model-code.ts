import type { VinDecoder } from './decoder';
import { vagMakesOf, vagModelCodes } from './vag-model-codes';

export const vagModelCodeDecoder: VinDecoder = {
  name: 'vag-model-code',
  version: 1,
  async decode(vin) {
    const wmi = vin.slice(0, 3);
    const [firstMake] = vagMakesOf(wmi);
    if (!firstMake) return null;
    const code = vin.slice(6, 8);
    const makes = new Set(
      vagModelCodes(firstMake, code).map(({ make }) => make),
    );
    return {
      make: makes.size === 1 ? [...makes][0] : firstMake,
      identifiers: [{ type: 'vag-model-code', value: code }],
      facts: {},
      raw: { wmi, code, modelYear: vin[9] },
    };
  },
};
