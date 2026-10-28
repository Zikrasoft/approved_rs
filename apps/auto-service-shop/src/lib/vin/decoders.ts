import { bmwTypeCodeDecoder } from './bmw-type-code';
import type { VinDecoder } from './decoder';
import { mercedesBaumusterDecoder } from './mercedes-baumuster';

export const VIN_DECODERS_BY_NAME = {
  'bmw-type-code': bmwTypeCodeDecoder,
  'mercedes-baumuster': mercedesBaumusterDecoder,
} as const satisfies Record<string, VinDecoder>;

export type VinDecoderName = keyof typeof VIN_DECODERS_BY_NAME;

export const VIN_DECODER_NAMES = Object.keys(VIN_DECODERS_BY_NAME) as [
  VinDecoderName,
  ...VinDecoderName[],
];
