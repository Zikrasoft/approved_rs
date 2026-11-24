import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import {
  claimCatalogueWriter,
  holdCatalogueWriter,
} from '../../../../lib/catalogue-writer';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalogue-slugs',
  dbName: 'medusa-catalogue-slugs-integration',
  testSuite: ({ api, getContainer }) => {
    describe('catalogue slugs', () => {
      let adminHeaders: { headers: { authorization: string } };
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
      });

      const rename = (kind: string, id: string, slug: string) =>
        api
          .post('/admin/catalogue-slugs', { kind, id, slug }, adminHeaders)
          .catch(({ response }) => response);

      it('renames a Make, Model and Category slug, frees the old one and refuses a live one', async () => {
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

        expect((await catalog.retrieveMake(make.id)).slug).toBe('bayerische');
        expect((await catalog.retrieveVehicleModel(model.id)).slug).toBe(
          '3-series-f30-320d',
        );
        expect((await catalog.retrieveCategory(category.id)).slug).toBe(
          'oil-filters',
        );
        const other = await catalog.createCategories({
          slug: 'air-filters',
          name: 'Воздушные фильтры',
        });
        const taken = await rename('category', other.id, 'oil-filters');
        expect([taken.status, taken.data.code]).toEqual([409, 'SLUG_TAKEN']);
        expect((await rename('category', other.id, 'oil')).status).toBe(200);
        const created = await api.post(
          '/admin/makes',
          { name: 'BMW Alpina', slug: 'bmw' },
          adminHeaders,
        );
        expect(created.data.make.slug).toBe('bmw');
      });

      it('merges a duplicate Make into another, moving its Series', async () => {
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
      });

      it('moves a Series to another Make, giving a clashing Model a free slug', async () => {
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
        const [untouched] = await catalog.listVehicleModels({
          id: cupra.model.id,
        });
        expect(untouched).toMatchObject({ slug: 'leon-moved' });
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
