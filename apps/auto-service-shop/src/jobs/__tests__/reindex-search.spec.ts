import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import reindexSearch, { config } from '../reindex-search';

medusaIntegrationTestRunner({
  moduleName: 'reindex-search',
  dbName: 'medusa-reindex-search-integration',
  testSuite: ({ getContainer }) => {
    describe('the nightly search rebuild', () => {
      const reindexes = () =>
        jest
          .spyOn(getContainer().resolve(Modules.SEARCH), 'reindex')
          .mockResolvedValue({ job_id: 'job', indexes: [] });

      afterEach(() => jest.restoreAllMocks());

      it('is checked every hour', () => {
        expect(config).toEqual({
          name: 'reindex-search',
          schedule: '0 * * * *',
        });
      });

      it.each([
        ['winter', '2026-01-15T03:00:00Z'],
        ['summer', '2026-07-15T02:00:00Z'],
      ])(
        'swaps both indexes at 04:00 Belgrade time in %s',
        async (_season, at) => {
          const reindex = reindexes();

          await reindexSearch(getContainer(), { scheduledFor: new Date(at) });

          expect(reindex.mock.calls).toEqual([
            [{ index: ['part_identifier', 'catalogue_car'], strategy: 'swap' }],
          ]);
        },
      );

      it('leaves search alone at any other hour', async () => {
        const reindex = reindexes();

        await reindexSearch(getContainer(), {
          scheduledFor: new Date('2026-01-15T04:00:00Z'),
        });
        await reindexSearch(getContainer(), {
          scheduledFor: new Date('2026-07-15T03:00:00Z'),
        });

        expect(reindex).not.toHaveBeenCalled();
      });
    });
  },
});
