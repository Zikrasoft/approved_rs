import { Modules } from '@medusajs/framework/utils';
import {
  updateProductsWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows';

import { updateProductMetadata, updateStoreMetadata } from '../metadata';

jest.mock('@medusajs/medusa/core-flows', () => ({
  updateProductsWorkflow: jest.fn(),
  updateStoresWorkflow: jest.fn(),
}));

const run = jest.fn().mockResolvedValue({});

beforeEach(() => {
  run.mockClear();
  (updateProductsWorkflow as unknown as jest.Mock).mockReturnValue({ run });
});

const scopeWith = (rows: unknown[]) => {
  const locks: string[] = [];
  const scope = {
    resolve: (key: string) =>
      key === Modules.LOCKING
        ? {
            execute: async (lock: string, work: () => Promise<unknown>) => {
              locks.push(lock);
              return work();
            },
          }
        : { graph: jest.fn().mockResolvedValue({ data: rows }) },
  };
  return { scope, locks };
};

describe('updateProductMetadata', () => {
  it('merges the patch over what the database holds, inside the product lock', async () => {
    const { scope, locks } = scopeWith([
      {
        id: 'prod_1',
        metadata: { translated_from: 'abc', spec: { brand: 'Old' } },
      },
    ]);

    const metadata = await updateProductMetadata(scope as never, 'prod_1', {
      spec: { brand: 'Bosch' },
    });

    expect(metadata).toEqual({
      translated_from: 'abc',
      spec: { brand: 'Bosch' },
    });
    expect(run).toHaveBeenCalledWith({
      input: { selector: { id: 'prod_1' }, update: { metadata } },
    });
    expect(locks).toEqual(['product-metadata:prod_1']);
  });

  it('starts from nothing when the product has no metadata yet', async () => {
    const { scope } = scopeWith([{ id: 'prod_1', metadata: null }]);

    expect(
      await updateProductMetadata(scope as never, 'prod_1', {
        translated_from: 'x',
      }),
    ).toEqual({ translated_from: 'x' });
  });

  it('refuses a product that is gone', async () => {
    const { scope } = scopeWith([]);

    await expect(
      updateProductMetadata(scope as never, 'prod_gone', { a: 1 }),
    ).rejects.toMatchObject({ type: 'not_found' });
    expect(run).not.toHaveBeenCalled();
  });
});

describe('updateStoreMetadata', () => {
  it('keeps the other store metadata keys, inside the store lock', async () => {
    const storeRun = jest.fn().mockResolvedValue({});
    (updateStoresWorkflow as unknown as jest.Mock).mockReturnValue({
      run: storeRun,
    });
    const { scope, locks } = scopeWith([
      { id: 'store_1', metadata: { owner_note: 'x' } },
    ]);

    const metadata = await updateStoreMetadata(scope as never, {
      catalog_version: 'v2',
    });

    expect(metadata).toEqual({ owner_note: 'x', catalog_version: 'v2' });
    expect(storeRun).toHaveBeenCalledWith({
      input: { selector: { id: 'store_1' }, update: { metadata } },
    });
    expect(locks).toEqual(['store-metadata']);
  });
});
