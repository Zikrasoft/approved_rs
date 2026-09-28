import type {
  ILockingModule,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import {
  updateProductsWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows';

import { queryOne } from './query';

export type Metadata = Record<string, unknown>;

type Row = { id: string; metadata?: Metadata | null };

async function mergeUnderLock(
  scope: MedusaContainer,
  lock: string,
  read: () => Promise<Row | undefined>,
  write: (id: string, metadata: Metadata) => Promise<unknown>,
  patch: Metadata,
): Promise<Metadata> {
  const locking = scope.resolve<ILockingModule>(Modules.LOCKING);
  return locking.execute(lock, async () => {
    const row = await read();
    if (!row) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Nothing to update: ${lock}`,
      );
    }
    const metadata = { ...(row.metadata ?? {}), ...patch };
    await write(row.id, metadata);
    return metadata;
  });
}

export function updateProductMetadata(
  scope: MedusaContainer,
  id: string,
  patch: Metadata,
): Promise<Metadata> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  return mergeUnderLock(
    scope,
    `product-metadata:${id}`,
    () => queryOne<Row>(query, 'product', ['id', 'metadata'], { id }),
    (productId, metadata) =>
      updateProductsWorkflow(scope).run({
        input: { selector: { id: productId }, update: { metadata } },
      }),
    patch,
  );
}

export function updateStoreMetadata(
  scope: MedusaContainer,
  patch: Metadata,
): Promise<Metadata> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY);
  return mergeUnderLock(
    scope,
    'store-metadata',
    async () =>
      (await query.graph({ entity: 'store', fields: ['id', 'metadata'] }))
        .data[0],
    (storeId, metadata) =>
      updateStoresWorkflow(scope).run({
        input: { selector: { id: storeId }, update: { metadata } },
      }),
    patch,
  );
}
