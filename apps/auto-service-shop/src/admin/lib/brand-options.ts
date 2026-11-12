import { z } from 'zod';

import { spellingKey } from '../../modules/_shared/spelling';

export const brandOptionsSchema = z.object({
  brands: z.array(
    z.object({
      name: z.string(),
      spellings: z.array(z.object({ value: z.string() })).default([]),
    }),
  ),
});

export type BrandOption = z.infer<typeof brandOptionsSchema>['brands'][number];

export const isNewBrand = (typed: string, brands: BrandOption[]): boolean => {
  const key = spellingKey(typed);
  return (
    key !== '' &&
    !brands.some(
      (brand) =>
        spellingKey(brand.name) === key ||
        brand.spellings.some(({ value }) => spellingKey(value) === key),
    )
  );
};
