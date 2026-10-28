import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import importLocal from '../import-local';
import publishLocal from '../publish-local';

medusaIntegrationTestRunner({
  moduleName: 'publish_local',
  testSuite: ({ getContainer }) => {
    describe('The local Publish', () => {
      const run = () =>
        publishLocal({ container: getContainer(), args: [] } as never);
      const importAll = () =>
        importLocal({ container: getContainer(), args: [] } as never);

      it('refuses while another catalogue writer runs', async () => {
        const runs: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const running = await runs.createCatalogueRuns({
          kind: 'import',
          status: 'running',
          heartbeat_at: new Date(),
          created_by: null,
        });
        try {
          await expect(run()).rejects.toMatchObject({ code: 'CATALOGUE_BUSY' });
          await expect(importAll()).rejects.toMatchObject({
            code: 'CATALOGUE_BUSY',
          });
        } finally {
          await runs.updateCatalogueRuns({
            id: running.id,
            status: 'failed',
            finished_at: new Date(),
          });
        }
      });

      it('records itself as a Publish run', async () => {
        const runs: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);

        await run();

        const [latest] = await runs.listCatalogueRuns(
          {},
          { order: { created_at: 'DESC' }, take: 1 },
        );
        expect(latest).toMatchObject({ kind: 'publish', status: 'succeeded' });
      });

      it('imports the Suppliers as an Import run of its own', async () => {
        const runs: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const adapters = process.env.SUPPLIER_ADAPTERS;
        process.env.SUPPLIER_ADAPTERS = '';
        try {
          await importAll();
        } finally {
          process.env.SUPPLIER_ADAPTERS = adapters;
        }

        const [latest] = await runs.listCatalogueRuns(
          {},
          { order: { created_at: 'DESC' }, take: 1 },
        );
        expect(latest).toMatchObject({
          kind: 'import',
          status: 'succeeded',
          report: { imports: [] },
        });
      });
    });
  },
});
