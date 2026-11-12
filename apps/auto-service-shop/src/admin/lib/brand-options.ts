import { z } from 'zod';

import { nameKey } from '../../modules/_shared/keys';

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
  const key = nameKey(typed);
  return (
    key !== '' &&
    !brands.some(
      (brand) =>
        nameKey(brand.name) === key ||
        brand.spellings.some(({ value }) => nameKey(value) === key),
    )
  );
};
