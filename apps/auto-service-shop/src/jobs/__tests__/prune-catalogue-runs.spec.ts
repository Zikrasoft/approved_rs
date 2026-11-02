import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import pruneCatalogueRuns, {
  pruneCatalogueRunsAt,
  RUNS_KEPT_FOR_DAYS,
} from '../prune-catalogue-runs';

const DAY_MS = 86_400_000;

type Run = {
  name: string;
  kind: 'import' | 'publish' | 'merge';
  supplier_id?: string;
  status: 'running' | 'succeeded' | 'failed';
  daysAgo: number;
};

const RUNS: Run[] = [
  {
    name: 'old import',
    kind: 'import',
    supplier_id: 's1',
    status: 'succeeded',
    daysAgo: RUNS_KEPT_FOR_DAYS + 30,
  },
  {
    name: 'old failed import',
    kind: 'import',
    supplier_id: 's1',
    status: 'failed',
    daysAgo: RUNS_KEPT_FOR_DAYS + 20,
  },
  {
    name: 'recent import',
    kind: 'import',
    supplier_id: 's1',
    status: 'succeeded',
    daysAgo: 1,
  },
  {
    name: 'last import of another supplier',
    kind: 'import',
    supplier_id: 's2',
    status: 'failed',
    daysAgo: RUNS_KEPT_FOR_DAYS + 30,
  },
  {
    name: 'older publish',
    kind: 'publish',
    status: 'succeeded',
    daysAgo: RUNS_KEPT_FOR_DAYS + 30,
  },
  {
    name: 'last publish',
    kind: 'publish',
    status: 'succeeded',
    daysAgo: RUNS_KEPT_FOR_DAYS + 10,
  },
  {
    name: 'old running merge',
    kind: 'merge',
    status: 'running',
    daysAgo: RUNS_KEPT_FOR_DAYS + 30,
  },
  { name: 'recent merge', kind: 'merge', status: 'succeeded', daysAgo: 1 },
];

medusaIntegrationTestRunner({
  moduleName: 'prune-catalogue-runs',
  dbName: 'medusa-prune-catalogue-runs-integration',
  testSuite: ({ getContainer }) => {
    describe('the catalogue run retention sweep', () => {
      it('deletes finished runs older than the retention unless one is the last of its kind and supplier', async () => {
        const publish: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION,
        );
        const ids = new Map<string, string>();
        for (const { name, daysAgo, ...run } of RUNS) {
          const created = await publish.createCatalogueRuns({
            ...run,
            heartbeat_at: new Date(),
          });
          await pg('catalogue_run')
            .where({ id: created.id })
            .update({ created_at: new Date(Date.now() - daysAgo * DAY_MS) });
          ids.set(created.id, name);
        }

        expect(await pruneCatalogueRunsAt(getContainer(), new Date())).toBe(3);
        await pruneCatalogueRuns(getContainer());

        const left = await publish.listCatalogueRuns({}, { take: null });
        expect(left.map(({ id }) => ids.get(id)).sort()).toEqual(
          [
            'recent import',
            'last import of another supplier',
            'last publish',
            'old running merge',
            'recent merge',
          ].sort(),
        );
      });
    });
  },
});
