import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const pgOf = (scope: MedusaContainer) =>
  scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

export async function publishAllNumbers(
  scope: MedusaContainer,
): Promise<string[]> {
  const { rows } = await pgOf(scope).raw<{ rows: { id: string }[] }>(
    `insert into published_number (id)
     select id from part_identifier where deleted_at is null
     on conflict (id) do nothing
     returning id`,
  );
  return rows.map(({ id }) => id);
}

export async function unmarkNumbersPublished(
  scope: MedusaContainer,
  ids: string[],
): Promise<void> {
  if (ids.length) {
    await pgOf(scope).raw('delete from published_number where id = any(?)', [
      ids,
    ]);
  }
}
