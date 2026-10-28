import type { ManufacturerVehicleIdentifierType } from '@podbor/catalog-contract';

export const LINKABLE_CODE_TYPES: Partial<
  Record<string, ManufacturerVehicleIdentifierType>
> = { bmw: 'bmw-type-code' };

export const MAX_LINKED_VEHICLES = 50;
