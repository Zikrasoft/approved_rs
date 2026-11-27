import {
  STAGED_DATA_KINDS,
  supplierImage,
  type SupplierData,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { pictureSchema, type Picture } from '../../lib/images';
import type SupplierModuleService from './service';

const stagedPayloadSchema = z.object({
  items: z.array(z.unknown()),
  pictures: z.record(z.string(), pictureSchema).optional(),
});

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
  const pictures = new Map<string, Picture>();
  for (const record of staged) {
    if (!record.supplier.released_kinds.includes(record.kind)) continue;
    const key = `${record.part_identifier_id}:${record.kind}`;
    const payload = stagedPayloadSchema.parse(record.payload);
    for (const [image, picture] of Object.entries(payload.pictures ?? {})) {
      pictures.set(image, picture);
    }
    const known = items.get(key);
    if (known) known.push(...payload.items);
    else items.set(key, payload.items);
  }
  return (identifierId) => {
    const data = Object.fromEntries(
      STAGED_DATA_KINDS.map((kind) => [
        kind,
        items.get(`${identifierId}:${kind}`) ?? [],
      ]),
    ) as Omit<SupplierData, 'photos'>;
    return {
      ...data,
      photos: data.images.map(
        (image) => pictures.get(image) ?? supplierImage(image),
      ),
    };
  };
}
