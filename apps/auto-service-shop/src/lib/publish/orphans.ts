import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const missingIdentifier = (column: string) =>
  `not exists (select 1 from part_identifier p where p.id = ${column} and p.deleted_at is null)`;

const SWEEPS = [
  `delete from supplier_offer o where ${missingIdentifier('o.part_identifier_id')}`,
  `delete from staged_record r where ${missingIdentifier('r.part_identifier_id')}`,
  `delete from published_number n where ${missingIdentifier('n.id')}`,
  `update vin_lookup l set vehicle_id = null where vehicle_id is not null
   and not exists (select 1 from vehicle v where v.id = l.vehicle_id and v.deleted_at is null)`,
];

export async function sweepOrphans(scope: MedusaContainer): Promise<void> {
  const pg = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  await pg.transaction(async (trx) => {
    for (const sweep of SWEEPS) await trx.raw(sweep);
  });
}
