import { STAGED_DATA_KINDS, type SupplierData } from '@podbor/catalog-contract';
import { z } from 'zod';

import type SupplierModuleService from './service';

const stagedPayloadSchema = z.object({ items: z.array(z.unknown()) });

export async function releasedSupplierData(
  suppliers: SupplierModuleService,
  identifierIds: string[],
): Promise<(identifierId: string) => SupplierData> {
  const staged = identifierIds.length
    ? await suppliers.listStagedRecords(
        { part_identifier_id: identifierIds },
        { relations: ['supplier'], take: null },
      )
    : [];
  return (identifierId) =>
    Object.fromEntries(
      STAGED_DATA_KINDS.map((kind) => [
        kind,
        staged
          .filter(
            (record) =>
              record.part_identifier_id === identifierId &&
              record.kind === kind &&
              record.supplier.released_kinds.includes(kind),
          )
          .flatMap((record) => stagedPayloadSchema.parse(record.payload).items),
      ]),
    ) as SupplierData;
}
