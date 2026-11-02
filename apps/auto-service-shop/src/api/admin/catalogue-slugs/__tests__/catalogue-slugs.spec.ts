import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../../../../lib/catalogue-writer';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const place = (fields: Record<string, string>) => ({
  brand: null,
  make: null,
  model: null,
  vehicle: null,
  category: null,
  part: null,
  ...fields,
});

medusaIntegrationTestRunner({
  moduleName: 'catalogue-slugs',
  dbName: 'medusa-catalogue-slugs-integration',
  testSuite: ({ api, getContainer }) => {
    describe('catalogue slugs and redirects', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: Record<string, string> };
      let catalog: CatalogModuleService;

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@catalogue-slugs.local',
          'supersecret',
        );
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'catalogue-slugs',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
      });

      const rename = (kind: string, id: string, slug: string) =>
        api
          .post('/admin/catalogue-slugs', { kind, id, slug }, adminHeaders)
          .catch(({ response }) => response);

      const redirects = async () =>
        (await api.get('/store/catalogue-redirects', storeHeaders)).data
          .redirects;

      it('renames a Make, Model and Category slug, redirects each old one and never gives it out again', async () => {
        const { make, model } = await createVehicleFixture(catalog);
        const category = await catalog.createCategories({
          slug: 'oil',
          name: 'Масляные фильтры',
        });

        expect((await rename('make', make.id, 'bayerische')).status).toBe(200);
        expect(
          (await rename('model', model.id, '3-series-f30-320d')).status,
        ).toBe(200);
        expect(
          (await rename('category', category.id, 'oil-filters')).status,
        ).toBe(200);

        expect(await redirects()).toEqual(
          expect.arrayContaining([
            {
              from: place({ make: 'bmw' }),
              to: place({ make: 'bayerische' }),
            },
            {
              from: place({ make: 'bayerische', model: 'f30-320d' }),
              to: place({ make: 'bayerische', model: '3-series-f30-320d' }),
            },
            {
              from: place({ category: 'oil' }),
              to: place({ category: 'oil-filters' }),
            },
          ]),
        );
        const reused = await rename('category', category.id, 'oil');
        expect(reused.status).toBe(409);
        expect(reused.data.code).toBe('SLUG_TAKEN');
        const created = await api
          .post(
            '/admin/makes',
            { name: 'BMW Alpina', slug: 'bmw' },
            adminHeaders,
          )
          .catch(({ response }) => response);
        expect(created.data.code).toBe('SLUG_TAKEN');
      });

      it('points a deleted Part at its Category and a deleted Vehicle at its Model', async () => {
        const { vehicle } = await createVehicleFixture(catalog);
        const category = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const brand = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: category.id,
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value: 'HU 816 x',
            },
          ],
        });

        expect(
          (await api.delete(`/admin/parts/${partId}`, adminHeaders)).status,
        ).toBe(200);
        expect(
          (await api.delete(`/admin/vehicles/${vehicle.id}`, adminHeaders))
            .status,
        ).toBe(200);

        expect(await redirects()).toEqual(
          expect.arrayContaining([
            {
              from: place({ part: 'mann-filter-hu816x' }),
              to: place({ category: 'oil-filters' }),
            },
            {
              from: place({
                make: 'bmw',
                model: 'f30-320d',
                vehicle: vehicle.slug,
              }),
              to: place({ make: 'bmw', model: 'f30-320d' }),
            },
          ]),
        );
      });

      it('keeps one redirect from a Part page deleted again after a re-import, pointing where the last deletion sent it', async () => {
        const brand = await catalog.createBrands({
          name: 'Bosch',
          slug: 'bosch',
        });
        const deletePartIn = async (slug: string) => {
          const category = await catalog.createCategories({
            slug,
            name: slug,
          });
          const partId = await catalog.createPartWithIdentifiers({
            name: 'Свеча зажигания',
            category_id: category.id,
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: brand.id,
                value: 'FR7DC',
              },
            ],
          });
          expect(
            (await api.delete(`/admin/parts/${partId}`, adminHeaders)).status,
          ).toBe(200);
        };

        await deletePartIn('spark-plugs');
        await deletePartIn('ignition');

        expect(
          await catalog.listSlugRedirects({
            kind: 'part',
            from_slug: 'bosch-fr7dc',
          }),
        ).toHaveLength(1);
        expect(
          (await redirects()).filter(({ from }) => from.part === 'bosch-fr7dc'),
        ).toEqual([
          {
            from: place({ part: 'bosch-fr7dc' }),
            to: place({ category: 'ignition' }),
          },
        ]);
      });

      it('merges a duplicate Make into another, moving its Series and redirecting its pages', async () => {
        const vw = await createVehicleFixture(catalog, {
          make: { slug: 'vw', name: 'VW' },
          modelSlug: 'golf-5k1-1-4-tsi',
          chassisCode: '5K1',
          engineCode: 'CAXA',
          engineFamily: 'EA111',
          typeCode: '1K11',
        });
        const volkswagen = await catalog.createMakes({
          name: 'Volkswagen',
          slug: 'volkswagen',
        });

        const merged = await api.post(
          `/admin/makes/${vw.make.id}/merge`,
          { into: volkswagen.id },
          adminHeaders,
        );

        expect(merged.status).toBe(200);
        expect(await catalog.listMakes({ id: vw.make.id })).toEqual([]);
        const [series] = await catalog.listSeries({ id: vw.series.id });
        expect(series.make_id).toBe(volkswagen.id);
        expect(await redirects()).toEqual(
          expect.arrayContaining([
            { from: place({ make: 'vw' }), to: place({ make: 'volkswagen' }) },
          ]),
        );
        const self = await api
          .post(
            `/admin/makes/${volkswagen.id}/merge`,
            { into: volkswagen.id },
            adminHeaders,
          )
          .catch(({ response }) => response);
        expect(self.data.code).toBe('MERGE_INTO_SELF');
      });

      it('merges same-named Series, Chassis and Models of the two Makes into one, keeping every Vehicle', async () => {
        const vw = await createVehicleFixture(catalog, {
          make: { slug: 'vw', name: 'VW' },
          modelSlug: 'vw-golf',
          chassisCode: '5K1',
          engineCode: 'CAXA',
          engineFamily: 'EA111',
          typeCode: '1K11',
        });
        const volkswagen = await createVehicleFixture(catalog, {
          make: { slug: 'volkswagen', name: 'Volkswagen' },
          modelSlug: 'volkswagen-golf',
          chassisCode: '5K1',
          engineCode: 'CAXA',
          engineFamily: 'EA111',
          typeCode: '1K12',
        });

        const merged = await api.post(
          `/admin/makes/${vw.make.id}/merge`,
          { into: volkswagen.make.id },
          adminHeaders,
        );

        expect(merged.status).toBe(200);
        const [model] = await catalog.listVehicleModels(
          { id: volkswagen.model.id },
          { relations: ['vehicles'] },
        );
        expect(model.vehicles.map(({ id }) => id).sort()).toEqual(
          [vw.vehicle.id, volkswagen.vehicle.id].sort(),
        );
        expect(new Set(model.vehicles.map(({ slug }) => slug)).size).toBe(2);
        const moved = model.vehicles.find(({ id }) => id === vw.vehicle.id);
        expect(moved?.slug).not.toBe(vw.vehicle.slug);
        expect(await catalog.listSeries({ make_id: vw.make.id })).toEqual([]);
        expect(await redirects()).toEqual(
          expect.arrayContaining([
            { from: place({ make: 'vw' }), to: place({ make: 'volkswagen' }) },
            {
              from: place({ make: 'volkswagen', model: 'vw-golf' }),
              to: place({ make: 'volkswagen', model: 'volkswagen-golf' }),
            },
            {
              from: place({
                make: 'volkswagen',
                model: 'vw-golf',
                vehicle: vw.vehicle.slug,
              }),
              to: place({
                make: 'volkswagen',
                model: 'volkswagen-golf',
                vehicle: moved?.slug ?? '',
              }),
            },
          ]),
        );
      });

      it('moves a Series to another Make, keeping each old Model URL answering', async () => {
        const seatMake = await catalog.createMakes({
          name: 'Seat Move',
          slug: 'seat-move',
        });
        const leon = await catalog.createSeries({
          make_id: seatMake.id,
          name: 'Leon',
        });
        const chassis = await catalog.createChassis({
          series_id: leon.id,
          code: '5F1',
        });
        const seatModel = await catalog.createVehicleModels({
          chassis_id: chassis.id,
          slug: 'leon-moved',
          name: '1.4 TSI',
        });
        const cupra = await createVehicleFixture(catalog, {
          make: { slug: 'cupra-move', name: 'Cupra Move' },
          modelSlug: 'leon-moved',
          chassisCode: 'KL1',
          engineCode: 'DNUA',
          engineFamily: 'EA888',
          typeCode: 'KL11',
        });

        await catalog.updateSeries({ id: leon.id, make_id: cupra.make.id });

        const [moved] = await catalog.listVehicleModels({ id: seatModel.id });
        expect(moved.make_id).toBe(cupra.make.id);
        expect(moved.slug).not.toBe('leon-moved');
        expect(await redirects()).toEqual(
          expect.arrayContaining([
            {
              from: place({ make: 'seat-move', model: 'leon-moved' }),
              to: place({ make: 'cupra-move', model: moved.slug }),
            },
          ]),
        );
        const [untouched] = await catalog.listVehicleModels({
          id: cupra.model.id,
        });
        expect(untouched).toMatchObject({ slug: 'leon-moved' });
      });

      it('records who merged a Make on the redirects it leaves', async () => {
        const vw = await createVehicleFixture(catalog, {
          make: { slug: 'vw-actor', name: 'VW Actor' },
          modelSlug: 'actor-golf',
          chassisCode: '5K1',
          engineCode: 'CAXA',
          engineFamily: 'EA111',
          typeCode: '1K13',
        });
        const target = await catalog.createMakes({
          name: 'Volkswagen Actor',
          slug: 'volkswagen-actor',
        });
        const [admin] = await getContainer()
          .resolve(Modules.USER)
          .listUsers({ email: 'admin@catalogue-slugs.local' });

        await api.post(
          `/admin/makes/${vw.make.id}/merge`,
          { into: target.id },
          adminHeaders,
        );

        const [left] = await catalog.listSlugRedirects({
          kind: 'make',
          from_id: vw.make.id,
        });
        expect(left).toMatchObject({
          created_by: admin.id,
          updated_by: admin.id,
        });
      });

      it('refuses a merge and a slug rename while another catalogue writer runs', async () => {
        const vw = await createVehicleFixture(catalog, {
          make: { slug: 'vw-busy', name: 'VW Busy' },
          modelSlug: 'busy-golf',
          chassisCode: '5K1',
          engineCode: 'CAXA',
          engineFamily: 'EA111',
          typeCode: '1K14',
        });
        const target = await catalog.createMakes({
          name: 'Volkswagen Busy',
          slug: 'volkswagen-busy',
        });
        const running = await claimCatalogueWriter(getContainer(), {
          kind: 'import',
          created_by: null,
        });

        const refused = [
          await api
            .post(
              `/admin/makes/${vw.make.id}/merge`,
              { into: target.id },
              adminHeaders,
            )
            .catch(({ response }) => response),
          await rename('make', vw.make.id, 'vw-busier'),
        ];
        await holdCatalogueWriter(getContainer(), running.id, async () => 0);

        expect(refused.map(({ status, data }) => [status, data.code])).toEqual(
          Array(2).fill([409, 'CATALOGUE_BUSY']),
        );
        expect(await catalog.listMakes({ id: vw.make.id })).toHaveLength(1);
        expect((await rename('make', vw.make.id, 'vw-busier')).status).toBe(
          200,
        );
      });

      it('never gives a Make a storefront section slug', async () => {
        const computed = await catalog.createMakes({ name: 'Search' });
        expect(computed.slug).toBe('search-2');

        const renamed = await rename('make', computed.id, 'cart');
        expect([renamed.status, renamed.data.code]).toEqual([
          400,
          'SLUG_RESERVED',
        ]);
        const created = await api
          .post('/admin/makes', { name: 'P Motors', slug: 'p' }, adminHeaders)
          .catch(({ response }) => response);
        expect([created.status, created.data.code]).toEqual([
          400,
          'SLUG_RESERVED',
        ]);
      });
    });
  },
});
