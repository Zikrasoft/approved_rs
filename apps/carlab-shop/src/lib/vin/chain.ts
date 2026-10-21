import type { MedusaContainer } from '@medusajs/framework/types';

import { parseEnv } from '../env';
import type { VinDecoder } from './decoder';
import { VIN_DECODERS_BY_NAME } from './decoders';

export const VIN_DECODERS_REGISTRATION = 'vinDecoders';

export const vinDecoders = (scope: MedusaContainer): VinDecoder[] =>
  scope.hasRegistration(VIN_DECODERS_REGISTRATION)
    ? scope.resolve<VinDecoder[]>(VIN_DECODERS_REGISTRATION)
    : parseEnv(process.env).VIN_DECODERS.map(
        (name) => VIN_DECODERS_BY_NAME[name],
      );
