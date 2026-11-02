import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../modules/publish';
import type PublishModuleService from '../../../modules/publish/service';

type Page = { value: string; listed: boolean | null };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-listed-numbers',
  testSuite: ({ api, getContainer }) => {
    describe('Which brand-numbers are listed', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'listed-numbers-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
        const brand = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const filters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const part = (
          numbers: { value: string; superseded?: boolean }[],
        ): Promise<string> =>
          catalog.createPartWithIdentifiers({
            name: `Фильтр ${numbers[0].value}`,
            category_id: filters.id,
            identifiers: numbers.map((number) => ({
              type: 'manufacturer-number' as const,
              brand_id: brand.id,
              ...number,
            })),
          });

        await part([{ value: 'HU 1' }, { value: 'HU 0', superseded: true }]);
        await part([{ value: 'HU 2', superseded: true }]);
        const replaced = await part([{ value: 'HU 3' }]);
        const replacement = await part([{ value: 'HU 4' }]);
        await catalog.updateParts({
          id: replaced,
          replaced_by_id: replacement,
        });

        await getContainer()
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      const pages = async (): Promise<Page[]> =>
        (await api.get('/store/part-pages?limit=100', storeHeaders)).data.pages;

      it('tells the storefront, per page, the listing Publish wrote', async () => {
        expect(
          Object.fromEntries(
            (await pages()).map(({ value, listed }) => [value, listed]),
          ),
        ).toEqual({
          'HU 0': false,
          'HU 1': true,
          'HU 2': true,
          'HU 3': false,
          'HU 4': true,
        });
      });

      it('lists in a Category exactly the pages the storefront is told are listed', async () => {
        const listing = await api.get(
          '/store/search?locale=ru&category=oil-filters',
          storeHeaders,
        );

        expect(
          listing.data.results.map(({ value }: { value: string }) => value),
        ).toEqual(
          expect.arrayContaining(
            (await pages())
              .filter(({ listed }) => listed)
              .map(({ value }) => value),
          ),
        );
        expect(listing.data.count).toBe(3);
      });

      it('still finds an unlisted number typed in full', async () => {
        const found = await api.get(
          '/store/search?locale=ru&q=HU%200',
          storeHeaders,
        );

        expect(
          found.data.results.map(({ value }: { value: string }) => value),
        ).toContain('HU 0');
      });
    });
  },
});
