import type { MedusaContainer } from '@medusajs/framework/types';

import { bmwTypeCodeDecoder } from './bmw-type-code';
import type { VinDecoder } from './decoder';
import { mercedesBaumusterDecoder } from './mercedes-baumuster';

export const VIN_DECODER_CHAIN: VinDecoder[] = [
  bmwTypeCodeDecoder,
  mercedesBaumusterDecoder,
];

export const VIN_DECODERS_REGISTRATION = 'vinDecoders';

export const vinDecoders = (scope: MedusaContainer): VinDecoder[] =>
  scope.hasRegistration(VIN_DECODERS_REGISTRATION)
    ? scope.resolve<VinDecoder[]>(VIN_DECODERS_REGISTRATION)
    : VIN_DECODER_CHAIN;
