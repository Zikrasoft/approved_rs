import { MedusaError } from '@medusajs/framework/utils';
import { normalizePartNumber } from '@podbor/catalog-contract';

import { adminError } from './admin-error';
import { withoutCodeLists } from './slug';

export { normalizePartNumber };

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

const withoutMarks = (value: string) =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '');

export const nameKey = (name: string): string =>
  withoutMarks(name)
    .replace(/[\s._-]+/gu, ' ')
    .trim()
    .toUpperCase();

export const codeKey = (code: string): string =>
  withoutMarks(code)
    .replace(/[\s.-]+/gu, '')
    .toUpperCase();

export const variantKey = (name: string): string =>
  nameKey(withoutCodeLists(name)).replace(/[^\p{L}\p{N}]+/gu, '');
