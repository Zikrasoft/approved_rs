import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { DEMAND_MODULE } from '../../modules/demand';
import { DEMAND_WINDOW_DAYS } from '../../modules/demand/ranking';
import type DemandModuleService from '../../modules/demand/service';
import { PART_CHANGED_EVENT } from '../../search/part-changed-event';
import refreshPartDemand, {
  config,
  DEMAND_KEPT_DAYS,
  refreshPartDemandAt,
} from '../refresh-part-demand';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-11-02T03:00:00Z');
const daysBefore = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

medusaIntegrationTestRunner({
  moduleName: 'refresh-part-demand',
  dbName: 'medusa-refresh-part-demand-integration',
  testSuite: ({ getContainer }) => {
    describe('the daily demand refresh', () => {
      const parts: Record<string, string> = {};
      const identifiers: Record<string, string> = {};
      const demand = () =>
        getContainer().resolve<DemandModuleService>(DEMAND_MODULE);
      const emitted = () => {
        const emit = jest.spyOn(
          getContainer().resolve(Modules.EVENT_BUS),
          'emit',
        );
        return () =>
          emit.mock.calls
            .flatMap(([messages]) => [messages].flat())
            .filter(({ name }) => name === PART_CHANGED_EVENT)
            .map(({ data }) => (data as { part_id: string }).part_id)
            .sort();
      };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const [bosch] = await catalog.createBrands([
          { name: 'Bosch', slug: 'bosch' },
        ]);
        for (const name of ['fresh', 'leaving', 'stale']) {
          parts[name] = await catalog.createPartWithIdentifiers({
            name,
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: bosch.id,
                value: `${name}-1`,
              },
            ],
          });
          [{ id: identifiers[name] }] = await catalog.listPartIdentifiers({
            part_id: parts[name],
          });
        }
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      afterEach(() => jest.restoreAllMocks());

      it('runs once a day', () => {
        expect(config).toMatchObject({ name: 'refresh-part-demand' });
        expect(config.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
      });

      it('reindexes the numbers whose score may have moved, including one whose last day just left the window', async () => {
        await demand().record({
          signal: 'inquiry',
          identifierIds: [identifiers.fresh],
          at: daysBefore(1),
        });
        await demand().record({
          signal: 'inquiry',
          identifierIds: [identifiers.leaving],
          at: daysBefore(DEMAND_WINDOW_DAYS),
        });
        await demand().record({
          signal: 'inquiry',
          identifierIds: [identifiers.stale],
          at: daysBefore(DEMAND_WINDOW_DAYS + 1),
        });
        const reindexed = emitted();

        await refreshPartDemandAt(getContainer(), NOW);

        expect(reindexed()).toEqual([parts.fresh, parts.leaving].sort());
      });

      it('forgets demand older than it keeps', async () => {
        await demand().record({
          signal: 'pick',
          identifierIds: [identifiers.stale],
          at: daysBefore(DEMAND_KEPT_DAYS + 1),
        });

        await refreshPartDemand(getContainer());

        expect(
          (await demand().countsSince(daysBefore(DEMAND_KEPT_DAYS + 5))).find(
            ({ id, picks }) => id === identifiers.stale && picks > 0,
          ),
        ).toBeUndefined();
      });
    });
  },
});
