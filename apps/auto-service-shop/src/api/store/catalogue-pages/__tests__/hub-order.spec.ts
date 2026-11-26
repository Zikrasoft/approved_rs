import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { DEMAND_MODULE } from '../../../../modules/demand';
import type DemandModuleService from '../../../../modules/demand/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-pages-hub-order',
  dbName: 'medusa-catalogue-pages-hub-order-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages, what orders the parts hub', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const publish: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const demand: DemandModuleService =
          getContainer().resolve(DEMAND_MODULE);
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'hub-order-tests',
            type: 'publishable',
            created_by: 'test',
          });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const brand = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const filters = await catalog.createCategories({
          slug: 'filters',
          name: 'Filters',
        });
        const wipers = await catalog.createCategories({
          slug: 'wipers',
          name: 'Wipers',
        });
        const numbered = (value: string, category_id: string) =>
          catalog.findOrCreatePart({
            name: `Part ${value}`,
            description: 'Fits',
            category_id,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });

        const first = await createVehicleFixture(catalog, {
          typeCode: 'HO1',
          seriesName: 'First',
          modelSlug: 'first-model',
          chassisCode: 'H1',
        });
        const second = await createVehicleFixture(catalog, {
          typeCode: 'HO2',
          seriesName: 'Second',
          modelSlug: 'second-model',
          chassisCode: 'H2',
        });
        const rival = await createVehicleFixture(catalog, {
          make: { slug: 'rival', name: 'Rival' },
          typeCode: 'HO3',
          seriesName: 'Only',
          modelSlug: 'rival-model',
          chassisCode: 'H3',
        });

        const shared = await Promise.all(
          ['F 1', 'F 2'].map((value) => numbered(value, filters.id)),
        );
        const onlyFirst = await numbered('F 3', filters.id);
        const onlySecond = await numbered('F 4', filters.id);
        const rivals = await Promise.all(
          ['F 5', 'F 6', 'F 7', 'F 8', 'F 9'].map((value) =>
            numbered(value, filters.id),
          ),
        );
        const wiper = await numbered('W 1', wipers.id);

        await catalog.createFitments([
          ...shared.flatMap(({ part_id }) => [
            { part_id, vehicle_id: first.vehicle.id },
            { part_id, vehicle_id: second.vehicle.id },
          ]),
          { part_id: onlyFirst.part_id, vehicle_id: first.vehicle.id },
          { part_id: onlySecond.part_id, vehicle_id: second.vehicle.id },
          ...rivals.map(({ part_id }) => ({
            part_id,
            vehicle_id: rival.vehicle.id,
          })),
        ]);
        await publish.publishAll();
        await publish.buildCatalogueSnapshot();
        await demand.record({
          signal: 'order',
          identifierIds: [wiper.part_identifier_id],
        });
      });

      const list = async () =>
        (await api.get('/store/catalogue-pages', storeHeaders)).data;

      it('sends make parts as an ordering hint summed over its series, a Part fitting two series counted twice', async () => {
        const { makes } = await list();
        const parts = (slug: string) =>
          makes.find((make: { slug: string }) => make.slug === slug).parts;

        expect(parts('bmw')).toBe(6);
        expect(parts('rival')).toBe(5);
      });

      it('sends the demand of a Category, and a demanded Category can be smaller than the rest', async () => {
        const { categories } = await list();
        const of = (slug: string) =>
          categories.find(
            (category: { slug: string }) => category.slug === slug,
          );

        expect(of('filters').listed).toBeGreaterThan(of('wipers').listed);
        expect(of('filters').demand).toBe(0);
        expect(of('wipers').demand).toBeGreaterThan(0);
      });
    });
  },
});
