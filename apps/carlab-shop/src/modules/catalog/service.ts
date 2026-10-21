import type { Context } from '@medusajs/framework/types';
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';
import { normalizePartNumber } from '@podbor/catalog-contract';

import Brand from './models/brand';
import BrandSpelling from './models/brand-spelling';
import Fitment from './models/fitment';
import Part from './models/part';
import PartIdentifier, {
  type PART_IDENTIFIER_TYPES,
} from './models/part-identifier';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';

type Provenance = {
  source?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type NewPartIdentifier = {
  type: (typeof PART_IDENTIFIER_TYPES)[number];
  brand_id: string;
  value: string;
};

export type NewPart = Provenance & {
  name: string;
  identifiers: NewPartIdentifier[];
};

class CatalogModuleService extends MedusaService({
  Brand,
  BrandSpelling,
  Part,
  PartIdentifier,
  Vehicle,
  VehicleIdentifier,
  Fitment,
}) {
  @InjectTransactionManager()
  async createPartWithIdentifiers(
    { name, identifiers, ...provenance }: NewPart,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<string> {
    const created = await this.createParts(
      { name, ...provenance },
      sharedContext,
    );
    await this.createPartIdentifiers(
      identifiers.map((identifier) => ({
        ...identifier,
        normalized_value: normalizePartNumber(identifier.value),
        part_id: created.id,
        ...provenance,
      })),
      sharedContext,
    );
    return created.id;
  }
}

export default CatalogModuleService;
