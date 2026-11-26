import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-pages',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/catalogue-pages', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let unpublished: string;

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const publish: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'catalogue-pages-tests',
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
        const numbered = (value: string, description?: string) =>
          catalog.findOrCreatePart({
            name: `Part ${value}`,
            description,
            category_id: filters.id,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });

        const big = await createVehicleFixture(catalog, {
          typeCode: 'CP01',
          seriesName: 'Big series',
          modelSlug: 'big-model',
        });
        const small = await createVehicleFixture(catalog, {
          make: { slug: 'tiny', name: 'Tiny' },
          typeCode: 'CP02',
          seriesName: 'Small series',
          modelSlug: 'small-model',
        });
        const parts = await Promise.all(
          ['CP 1', 'CP 2', 'CP 3'].map((value) => numbered(value, 'Fits')),
        );
        const hidden = await numbered('CP 4', 'Fits');
        const bare = await numbered('CP 5');
        await numbered('CP 6');
        const gone = await catalog.createBrands({ name: 'Gone', slug: 'gone' });
        await catalog.findOrCreatePart({
          name: 'Part of a deleted brand',
          description: 'Fits',
          category_id: filters.id,
          identifier: {
            type: 'manufacturer-number',
            brand_id: gone.id,
            value: 'CP 7',
          },
          source: 'test',
        });
        unpublished = 'mann-filter-cp4';
        await catalog.createFitments([
          ...parts.map(({ part_id }) => ({
            part_id,
            vehicle_id: big.vehicle.id,
          })),
          { part_id: parts[0].part_id, vehicle_id: small.vehicle.id },
          { part_id: bare.part_id, vehicle_id: small.vehicle.id },
        ]);
        const bulbs = await catalog.createCategories({
          slug: 'bulbs',
          name: 'Bulbs',
        });
        await catalog.findOrCreatePart({
          name: 'Bulb',
          description: '\n\t',
          category_id: bulbs.id,
          identifier: {
            type: 'manufacturer-number',
            brand_id: brand.id,
            value: 'CP 8',
          },
          source: 'test',
        });
        await publish.publishAll();
        await publish.unpublish([hidden.part_identifier_id]);
        await publish.buildCatalogueSnapshot();
        await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)('brand')
          .where({ id: gone.id })
          .update({ deleted_at: new Date() });
      });

      const list = async () =>
        (await api.get('/store/catalogue-pages', storeHeaders)).data;

      it('lists published numbers and leaves out an unpublished one', async () => {
        const { parts } = await list();

        expect(parts.map(({ slug }: { slug: string }) => slug)).toEqual(
          expect.arrayContaining([
            'mann-filter-cp1',
            'mann-filter-cp2',
            'mann-filter-cp3',
            'mann-filter-cp5',
          ]),
        );
        expect(parts.map(({ slug }: { slug: string }) => slug)).not.toContain(
          unpublished,
        );
      });

      it('follows the noindex rule: a bare number is not indexable', async () => {
        const { parts } = await list();
        const indexable = (slug: string) =>
          parts.find((part: { slug: string }) => part.slug === slug).indexable;

        expect(indexable('mann-filter-cp1')).toBe(true);
        expect(indexable('mann-filter-cp5')).toBe(true);
        expect(indexable('mann-filter-cp6')).toBe(false);
      });

      it('judges a number noindex on the list and on its page alike when its description is blank', async () => {
        const { parts } = await list();
        const { page } = (
          await api.get(
            '/store/catalogue-pages/parts/mann-filter-cp8',
            storeHeaders,
          )
        ).data;

        expect(
          parts.find(
            ({ slug }: { slug: string }) => slug === 'mann-filter-cp8',
          ),
        ).toEqual({ slug: 'mann-filter-cp8', indexable: false });
        expect(page.indexable).toBe(false);
      });

      it('gives a series a page only when it holds enough Parts, and its Category page likewise', async () => {
        const { series, makes } = await list();

        expect(series).toEqual([
          {
            make: 'bmw',
            slug: expect.any(String),
            name: 'Big series',
            categories: ['filters'],
            listed: { filters: 3 },
          },
        ]);
        expect(makes).toEqual(
          expect.arrayContaining([
            { slug: 'bmw', name: 'BMW', hub: true, parts: expect.any(Number) },
            {
              slug: 'tiny',
              name: 'Tiny',
              hub: false,
              parts: expect.any(Number),
            },
          ]),
        );
      });

      it('sends the whole Make list with its site flag', async () => {
        const { catalogue_makes: makes } = await list();

        expect(makes).toEqual(
          expect.arrayContaining([
            { slug: 'bmw', name: 'BMW', show_on_site: expect.any(Boolean) },
          ]),
        );
      });

      it('counts the listed Part pages a Category page shows', async () => {
        const { categories } = await list();
        const page = (
          await api.get(
            '/store/catalogue-pages/categories/filters',
            storeHeaders,
          )
        ).data;

        expect(page.count).toBe(5);

        expect(categories).toEqual([
          { slug: 'filters', name: 'Filters', listed: 5, demand: 0 },
          { slug: 'bulbs', name: 'Bulbs', listed: 1, demand: 0 },
        ]);
      });
    });
  },
});
