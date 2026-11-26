import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';

import { CATALOG_MODULE } from '../../modules/catalog';

import { STORE_READ_TIMEOUT, storeRead } from '../store-read';

medusaIntegrationTestRunner({
  moduleName: 'store-read',
  testSuite: ({ getContainer }) => {
    describe('A store read in the shop', () => {
      const timeout = async () => {
        const catalog = getContainer().resolve<{
          __container__: { manager: SqlEntityManager };
        }>(CATALOG_MODULE);
        const [row] = await catalog.__container__.manager
          .fork()
          .execute<{ statement_timeout: string }[]>('show statement_timeout');
        return row.statement_timeout;
      };

      it('limits the module MikroORM reads made inside it and no others', async () => {
        const inside = await storeRead(getContainer(), () =>
          Promise.all(Array.from({ length: 12 }, timeout)),
        );
        const outside = await Promise.all(Array.from({ length: 12 }, timeout));

        expect(new Set(inside)).toEqual(new Set([STORE_READ_TIMEOUT]));
        expect(new Set(outside)).toEqual(new Set(['0']));
      });
    });
  },
});
