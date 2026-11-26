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
  const items = new Map<string, unknown[]>();
  for (const record of staged) {
    if (!record.supplier.released_kinds.includes(record.kind)) continue;
    const key = `${record.part_identifier_id}:${record.kind}`;
    const parsed = stagedPayloadSchema.parse(record.payload).items;
    const known = items.get(key);
    if (known) known.push(...parsed);
    else items.set(key, parsed);
  }
  return (identifierId) =>
    Object.fromEntries(
      STAGED_DATA_KINDS.map((kind) => [
        kind,
        items.get(`${identifierId}:${kind}`) ?? [],
      ]),
    ) as SupplierData;
}
