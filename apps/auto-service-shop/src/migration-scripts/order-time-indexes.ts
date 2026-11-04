import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const ORDER_TIME_INDEXES = [
  'create index if not exists "IDX_order_created_at" on "order" (created_at) where deleted_at is null',
  'create index if not exists "IDX_order_updated_at" on "order" (updated_at) where deleted_at is null',
];

export default async function orderTimeIndexes({
  container,
}: {
  container: MedusaContainer;
}): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  for (const statement of ORDER_TIME_INDEXES) {
    await pg.raw(statement);
  }
}
