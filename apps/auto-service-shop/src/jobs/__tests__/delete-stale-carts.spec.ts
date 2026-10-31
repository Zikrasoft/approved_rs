import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { deleteStaleCartsAt } from '../delete-stale-carts';

medusaIntegrationTestRunner({
  moduleName: 'delete-stale-carts',
  dbName: 'medusa-delete-stale-carts-integration',
  testSuite: ({ getContainer }) => {
    describe('the stale cart sweep', () => {
      it('deletes carts nobody touched for two weeks and keeps recent and completed ones', async () => {
        const carts = getContainer().resolve(Modules.CART);
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION,
        );
        const [stale, recent, completed] = await carts.createCarts([
          { currency_code: 'rsd' },
          { currency_code: 'rsd' },
          { currency_code: 'rsd' },
        ]);
        const weeksAgo = new Date(Date.now() - 15 * 86_400_000);
        await pg('cart')
          .whereIn('id', [stale.id, completed.id])
          .update({ updated_at: weeksAgo });
        await pg('cart')
          .where('id', completed.id)
          .update({ completed_at: weeksAgo });

        expect(await deleteStaleCartsAt(getContainer(), new Date())).toBe(1);

        const left = await carts.listCarts({
          id: [stale.id, recent.id, completed.id],
        });
        expect(left.map(({ id }) => id).sort()).toEqual(
          [recent.id, completed.id].sort(),
        );
      });
    });
  },
});
