import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import {
  claimCatalogueWriter,
  holdCatalogueWriter,
  startCatalogueRun,
} from '../catalogue-writer';

const IMPORT = { kind: 'import' as const, created_by: null };

const gate = () => {
  let open = () => undefined as void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
};

medusaIntegrationTestRunner({
  moduleName: 'catalogue_writer',
  testSuite: ({ getContainer }) => {
    describe('the catalogue writer lock', () => {
      const runs = () =>
        getContainer().resolve<PublishModuleService>(PUBLISH_MODULE);
      const claim = () =>
        claimCatalogueWriter(getContainer(), IMPORT).catch(
          (error: unknown) => error,
        );

      it('keeps a quiet writer that is still alive from being taken over', async () => {
        const { open, opened } = gate();
        const run = await claimCatalogueWriter(getContainer(), IMPORT);
        const held = holdCatalogueWriter(getContainer(), run.id, () => opened);
        await runs().updateCatalogueRuns({
          id: run.id,
          heartbeat_at: new Date(Date.now() - 60 * 60 * 1000),
        });

        const second = await claim();
        open();
        await held;

        expect(second).toMatchObject({ code: 'CATALOGUE_BUSY' });
        expect(await runs().retrieveCatalogueRun(run.id)).toMatchObject({
          status: 'succeeded',
        });
      });

      it('never runs two writers at once, however many start together', async () => {
        let running = 0;
        let most = 0;
        const work = async () => {
          running += 1;
          most = Math.max(most, running);
          await new Promise((resolve) => setTimeout(resolve, 200));
          running -= 1;
        };

        const started = await Promise.all(
          Array.from({ length: 6 }, () =>
            startCatalogueRun(getContainer(), IMPORT, work).catch(
              (error: unknown) => error,
            ),
          ),
        );
        const accepted = started.filter(
          (run) => (run as { id?: string }).id !== undefined,
        );
        for (let waited = 0; running && waited < 50; waited += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(accepted).toHaveLength(1);
        expect(most).toBe(1);
      });

      it('takes over a run whose writer is gone and marks it abandoned', async () => {
        const left = await runs().createCatalogueRuns({
          ...IMPORT,
          status: 'running',
          heartbeat_at: new Date(),
        });

        const run = await claimCatalogueWriter(getContainer(), IMPORT);
        await holdCatalogueWriter(
          getContainer(),
          run.id,
          async () => undefined,
        );

        expect(await runs().retrieveCatalogueRun(left.id)).toMatchObject({
          status: 'failed',
          error: 'Abandoned',
        });
      });

      it('frees the lock when the work fails', async () => {
        const run = await claimCatalogueWriter(getContainer(), IMPORT);
        await expect(
          holdCatalogueWriter(getContainer(), run.id, async () => {
            throw new Error('broken');
          }),
        ).rejects.toThrow('broken');

        const next = await claimCatalogueWriter(getContainer(), IMPORT);
        await holdCatalogueWriter(
          getContainer(),
          next.id,
          async () => undefined,
        );

        expect(await runs().retrieveCatalogueRun(run.id)).toMatchObject({
          status: 'failed',
          error: 'broken',
        });
      });
    });
  },
});
