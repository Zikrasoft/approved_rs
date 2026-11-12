import { normalizePartNumber } from '@podbor/catalog-contract';

import { withoutCodeLists } from './slug';

export { normalizePartNumber };

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
