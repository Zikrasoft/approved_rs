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

import { z } from 'zod';

import { selectOne } from './query';
import { metadataField } from './row-schema';

export type Metadata = Record<string, unknown>;

export const metadataRowSchema = z.object({
  id: z.string(),
  metadata: metadataField,
});

type Row = z.infer<typeof metadataRowSchema>;

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
    () => selectOne(query, 'product', metadataRowSchema, { id }),
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
    () => selectOne(query, 'store', metadataRowSchema, {}),
    (storeId, metadata) =>
      updateStoresWorkflow(scope).run({
        input: { selector: { id: storeId }, update: { metadata } },
      }),
    patch,
  );
}
