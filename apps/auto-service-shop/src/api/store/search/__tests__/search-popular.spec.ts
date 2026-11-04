import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { DEMAND_MODULE } from '../../../../modules/demand';
import type DemandModuleService from '../../../../modules/demand/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

type Response = {
  status: number;
  data: {
    count: number;
    results: {
      value: string;
      demand: { score: number; popular: boolean; top: boolean } | null;
    }[];
  };
};

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-search-popular',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search sorted by demand', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      const number: Record<string, string> = {};

      const search = (params: Record<string, string>): Promise<Response> =>
        api
          .get(
            `/store/search?${new URLSearchParams({ locale: 'ru', ...params })}`,
            storeHeaders,
          )
          .catch((error) => error.response);
      const values = ({ data }: Response) =>
        data.results.map(({ value }) => value);
      const demand = () =>
        getContainer().resolve<DemandModuleService>(DEMAND_MODULE);
      const reindex = () =>
        getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'popular-tests',
            type: 'publishable',
            created_by: 'test',
          });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
        const [varta] = await catalog.createBrands([
          { name: 'Varta', slug: 'varta' },
        ]);
        const batteries = await catalog.createCategories({
          slug: 'batteries',
          name: 'Аккумуляторы',
        });
        for (const value of ['VA 1', 'VB 2', 'VC 3', 'VD 4']) {
          const partId = await catalog.createPartWithIdentifiers({
            name: `Аккумулятор ${value}`,
            category_id: batteries.id,
            identifiers: [
              { type: 'manufacturer-number', brand_id: varta.id, value },
            ],
          });
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });
          number[value] = identifier.id;
        }
        await getContainer()
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
        await reindex();
      });

      it('lists in the default order while nothing is demanded', async () => {
        const plain = await search({ category: 'batteries' });
        const popular = await search({
          category: 'batteries',
          sort: 'popular',
        });

        expect(popular.status).toBe(200);
        expect(values(popular)).toEqual(values(plain));
        expect(
          popular.data.results.every(({ demand }) => demand === null),
        ).toBe(true);
      });

      it('refuses a sort it does not know', async () => {
        expect(
          (await search({ category: 'batteries', sort: 'price' })).status,
        ).toBe(400);
      });

      it('puts the most demanded numbers first once the index carries their demand, the rest in the default order', async () => {
        const plain = values(await search({ category: 'batteries' }));
        await demand().record({
          signal: 'inquiry',
          identifierIds: [number['VC 3'], number['VB 2']],
        });
        await demand().record({
          signal: 'order',
          identifierIds: [number['VC 3']],
        });
        await demand().record({
          signal: 'pick',
          identifierIds: [number['VD 4']],
        });
        await reindex();

        const popular = await search({
          category: 'batteries',
          sort: 'popular',
        });

        expect(values(popular)).toEqual([
          'VC 3',
          'VB 2',
          'VD 4',
          ...plain.filter((value) => !['VC 3', 'VB 2', 'VD 4'].includes(value)),
        ]);
        expect(popular.data.results[0].demand).toEqual({
          score: 8,
          popular: true,
          top: true,
        });
        expect(popular.data.results[2].demand).toEqual({
          score: 1,
          popular: false,
          top: false,
        });
        expect(values(await search({ category: 'batteries' }))).toEqual(plain);
      });

      it('remembers a query that found nothing, as the log redacts it', async () => {
        await search({ q: 'Exide EA 770' });
        await search({ q: 'exide  ea 770' });
        await search({ q: 'petar@example.com' });
        await search({ q: 'VA 1' });

        expect(
          await demand().missedQueriesSince(
            new Date(Date.now() - 86_400_000),
            10,
          ),
        ).toEqual([{ query: 'exide ea 770', count: 2 }]);
      });

      it('does not count a query that only found nothing under filters or past its last page', async () => {
        await search({ q: 'Varta', offset: '100' });
        await search({ q: 'Varta', facets: 'brand:bosch' });

        expect(
          (
            await demand().missedQueriesSince(
              new Date(Date.now() - 86_400_000),
              10,
            )
          ).map(({ query }) => query),
        ).not.toContain('varta');
      });
    });
  },
});
