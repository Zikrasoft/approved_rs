import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

const UNUSED_FOR_DAYS = 14;
const DAY_MS = 86_400_000;
const BATCH = 500;

export async function deleteStaleCartsAt(
  container: MedusaContainer,
  now: Date,
): Promise<number> {
  const carts = container.resolve(Modules.CART);
  const unusedSince = new Date(now.getTime() - UNUSED_FOR_DAYS * DAY_MS);
  let deleted = 0;
  for (;;) {
    const stale = await carts.listCarts(
      {
        completed_at: { $eq: null },
        updated_at: { $lt: unusedSince.toISOString() },
      },
      { select: ['id'], take: BATCH },
    );
    if (!stale.length) return deleted;
    await carts.deleteCarts(stale.map(({ id }) => id));
    deleted += stale.length;
  }
}

export default async function deleteStaleCarts(container: MedusaContainer) {
  await deleteStaleCartsAt(container, new Date());
}

export const config = {
  name: 'delete-stale-carts',
  schedule: '30 3 * * *',
};
