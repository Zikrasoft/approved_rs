import type { ManufacturerVehicleIdentifierType } from '@podbor/catalog-contract';

import { nameKey } from '../../modules/_shared/keys';

export const LINKABLE_CODE_TYPES: Partial<
  Record<string, ManufacturerVehicleIdentifierType>
> = { BMW: 'bmw-type-code' };

export const MAX_LINKED_VEHICLES = 50;

export const isMakeOfKey = (
  makeKey: string,
  make: { slug: string; name: string },
) => nameKey(make.name) === makeKey || nameKey(make.slug) === makeKey;
