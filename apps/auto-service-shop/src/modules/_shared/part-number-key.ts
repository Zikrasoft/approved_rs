import { MedusaError } from '@medusajs/framework/utils';
import { normalizePartNumber } from '@podbor/catalog-contract';

import { adminError } from './admin-error';

export const partNumberKey = (value: string): string => {
  const key = normalizePartNumber(value);
  if (!key) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'INVALID_FIELD',
      `${value} has no Latin letter or digit to key it by`,
    );
  }
  return key;
};
