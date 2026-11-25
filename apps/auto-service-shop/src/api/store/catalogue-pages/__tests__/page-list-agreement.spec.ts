import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATEGORY_PAGE_SIZE,
  categoryPageCount,
  categoryPagePath,
  makePagePath,
  partPagePath,
  seriesCategoryPagePath,
  seriesPagePath,
  type CataloguePageList,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

const pagesOf = ({ makes, series, categories, parts }: CataloguePageList) => [
  ...makes.filter(({ hub }) => hub).map(({ slug }) => makePagePath(slug)),
  ...series.flatMap(({ make, slug, categories: own }) => [
    seriesPagePath(make, slug),
    ...own.map((category) => seriesCategoryPagePath(make, slug, category)),
  ]),
  ...categories.flatMap(({ slug, listed }) =>
    Array.from({ length: categoryPageCount(listed ?? 0) }, (_, index) =>
      categoryPagePath(slug, index + 1),
    ),
  ),
  ...parts.map(({ slug }) => partPagePath(slug)),
];

medusaIntegrationTestRunner({
  moduleName: 'catalogue-page-list-agreement',
  testSuite: ({ api, getContainer }) => {
    describe('the catalogue page list and the page endpoints', () => {
      let storeHeaders: {
        headers: { 'x-publishable-api-key': string };
        validateStatus: () => boolean;
      };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const publish: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'page-list-agreement-tests',
            type: 'publishable',
            created_by: 'test',
          });
        storeHeaders = {
          headers: { 'x-publishable-api-key': key.token },
          validateStatus: () => true,
        };

        const brand = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const [filters, oils, bulbs] = await catalog.createCategories([
          { slug: 'filters', name: 'Filters' },
          { slug: 'oils', name: 'Oils' },
          { slug: 'bulbs', name: 'Bulbs' },
        ]);
        const viscosity = await catalog.createCategoryFields({
          category_id: oils.id,
          key: 'viscosity',
          type: 'single-select',
          label: 'Viscosity',
          facet: true,
          rank: 0,
        });
        await catalog.createCategoryFieldOptions([
          { field_id: viscosity.id, key: '5w-30', label: '5W-30' },
          { field_id: viscosity.id, key: '0w-20', label: '0W-20' },
        ]);
        const numbered = (
          value: string,
          category_id: string,
          extra: { description?: string; attributes?: Record<string, string> },
        ) =>
          catalog.findOrCreatePart({
            name: `Part ${value}`,
            category_id,
            ...extra,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });

        const fitted = await createVehicleFixture(catalog, {
          typeCode: 'AG01',
          seriesName: 'Fitted series',
          modelSlug: 'fitted-model',
        });
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'AG02',
          seriesName: 'Small series',
          modelSlug: 'small-model',
        });
        const required = await createVehicleFixture(catalog, {
          make: { slug: 'audi', name: 'Audi' },
          typeCode: 'AG03',
          seriesName: 'Required series',
          modelSlug: 'required-model',
          chassisCode: 'B8',
          engineCode: 'CAGA',
        });

        const filterParts: { part_id: string }[] = [];
        for (const value of ['AG 1', 'AG 2', 'AG 3']) {
          filterParts.push(
            await numbered(value, filters.id, { description: 'Fits' }),
          );
        }
        const lone = await numbered('AG 4', filters.id, {});
        await catalog.createFitments([
          ...filterParts.map(({ part_id }) => ({
            part_id,
            vehicle_id: fitted.vehicle.id,
          })),
          { part_id: lone.part_id, vehicle_id: small.vehicle.id },
        ]);
        for (const [value, grade] of [
          ['AG 5', '5w-30'],
          ['AG 6', '5w-30'],
          ['AG 7', '5w-30'],
          ['AG 8', '0w-20'],
        ]) {
          await numbered(value, oils.id, { attributes: { viscosity: grade } });
        }
        await catalog.createRequirement({
          field_id: viscosity.id,
          option_keys: ['5w-30'],
          min: null,
          max: null,
          quantity: 1,
          chassis_id: required.chassis.id,
        });
        for (let index = 0; index <= CATEGORY_PAGE_SIZE; index += 1) {
          await numbered(`AGB ${index}`, bulbs.id, {});
        }
        await publish.publishAll();
      });

      const list = async (): Promise<CataloguePageList> =>
        (await api.get('/store/catalogue-pages', storeHeaders)).data;

      it('answers 200 for every page the list names', async () => {
        const pages = pagesOf(await list());
        const statuses = await Promise.all(
          pages.map(async (path) => [
            path,
            (await api.get(path, storeHeaders)).status,
          ]),
        );

        expect(pages).toEqual(
          expect.arrayContaining([
            seriesPagePath('audi', seriesSlugOf('Required series')),
            seriesCategoryPagePath(
              'audi',
              seriesSlugOf('Required series'),
              'oils',
            ),
            categoryPagePath('bulbs', 2),
          ]),
        );
        expect(statuses.filter(([, status]) => status !== 200)).toEqual([]);
      });

      it('gives every Part page the indexable flag the list gives it', async () => {
        const { parts } = await list();
        const flags = await Promise.all(
          parts.map(async ({ slug }) => ({
            slug,
            indexable: (await api.get(partPagePath(slug), storeHeaders)).data
              .page.indexable,
          })),
        );

        expect(flags).toEqual(parts);
      });

      it('answers 404 for the pages the list leaves out', async () => {
        const { categories } = await list();
        const bulbs = categories.find(({ slug }) => slug === 'bulbs')!;
        const missing = [
          makePagePath('tiny'),
          seriesPagePath('tiny', seriesSlugOf('Small series')),
          seriesCategoryPagePath('bmw', seriesSlugOf('Fitted series'), 'oils'),
          categoryPagePath('bulbs', categoryPageCount(bulbs.listed ?? 0) + 1),
        ];

        const statuses = await Promise.all(
          missing.map(
            async (path) => (await api.get(path, storeHeaders)).status,
          ),
        );

        expect(statuses).toEqual(missing.map(() => 404));
      });
    });
  },
});
