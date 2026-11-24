import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_LOCALE_HEADER,
  MAKES_PAGE_PATH,
  makePagePath,
  makePageResponseSchema,
  makesPageResponseSchema,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { createVehicleFixture } from '../../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../../modules/publish';
import type PublishModuleService from '../../../../../modules/publish/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-make-pages',
  dbName: 'carlab_catalogue_make_pages',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages/makes', () => {
      let key: string;

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const publish: PublishModuleService = container.resolve(PUBLISH_MODULE);
        key = (
          await container
            .resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({
              title: 'catalogue-make-pages-tests',
              type: 'publishable',
              created_by: 'test',
            })
        ).token;
        const brand = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const filters = await catalog.createCategories({
          slug: 'filters',
          name: 'Фильтры',
        });
        await catalog.updateCategories({
          id: filters.id,
          translations: { sr: { name: 'Filteri' } },
        });
        const numbered = (value: string) =>
          catalog.findOrCreatePart({
            name: `Part ${value}`,
            description: 'Fits',
            category_id: filters.id,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });
        const big = await createVehicleFixture(catalog, {
          typeCode: 'MP01',
          seriesName: 'Big series',
          modelSlug: 'big-model',
        });
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'MP02',
          seriesName: 'Small series',
          modelSlug: 'small-model',
        });
        const parts = await Promise.all(['MP 1', 'MP 2', 'MP 3'].map(numbered));
        const hidden = await numbered('MP 4');
        await catalog.createFitments([
          ...parts.map(({ part_id }) => ({
            part_id,
            vehicle_id: big.vehicle.id,
          })),
          { part_id: parts[0].part_id, vehicle_id: small.vehicle.id },
          { part_id: hidden.part_id, vehicle_id: small.vehicle.id },
          { part_id: hidden.part_id, vehicle_id: big.vehicle.id },
        ]);
        await publish.publishAll();
        await publish.unpublish([hidden.part_identifier_id]);
      });

      const get = (path: string, headers: Record<string, string> = {}) =>
        api
          .get(path, { headers: { 'x-publishable-api-key': key, ...headers } })
          .catch((error) => error.response);

      it('lists the Makes with a series page and leaves out the rest', async () => {
        const response = await get(MAKES_PAGE_PATH);

        expect(response.status).toBe(200);
        expect(makesPageResponseSchema.parse(response.data).makes).toEqual([
          { slug: 'bmw', name: 'BMW' },
        ]);
      });

      it('answers a Make hub with its paged series and their Categories', async () => {
        const response = await get(makePagePath('bmw'));

        expect(response.status).toBe(200);
        expect(makePageResponseSchema.parse(response.data)).toEqual({
          make: { slug: 'bmw', name: 'BMW' },
          series: [
            {
              slug: seriesSlugOf('Big series'),
              name: 'Big series',
              categories: ['Фильтры'],
            },
          ],
        });
      });

      it('names the Categories in the locale of the header', async () => {
        const response = await get(makePagePath('bmw'), {
          [CATALOGUE_LOCALE_HEADER]: 'sr',
        });

        expect(response.data.series[0].categories).toEqual(['Filteri']);
      });

      it('answers 404 for a Make with no series page and for an unknown Make', async () => {
        expect((await get(makePagePath('tiny'))).status).toBe(404);
        expect((await get(makePagePath('nothing'))).status).toBe(404);
      });
    });
  },
});
