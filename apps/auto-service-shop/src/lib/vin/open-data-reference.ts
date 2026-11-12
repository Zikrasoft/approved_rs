import { typeKey } from './bmw-type-key';
import { vagReference } from './vag-model-codes';

export const openDataReference = (make: string, code: string) =>
  (make === 'bmw' && typeKey(code)) || vagReference(make, code);
