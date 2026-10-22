import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin vehicle reference data', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;

      const post = (path: string, body: unknown) =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const remove = (path: string) =>
        api.delete(path, adminHeaders).catch((error) => error.response);

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@vehicles-tests.local',
          'supersecret',
        );
      });

      it('builds a Vehicle with its type code from Make down, stamping the admin user', async () => {
        const make = (await post('/admin/makes', { slug: 'bmw', name: 'BMW' }))
          .data.make;
        const series = (
          await post('/admin/series', {
            make_id: make.id,
            name: '5 серия',
            translations: { sr: 'Serija 5', en: '5 Series' },
          })
        ).data.series;
        const chassis = (
          await post('/admin/chassis', {
            series_id: series.id,
            code: 'g30',
            body_style: 'sedan',
            year_from: 2017,
          })
        ).data.chassis;
        const model = (
          await post('/admin/vehicle-models', {
            chassis_id: chassis.id,
            slug: 'g30-520d',
            name: '520d',
          })
        ).data.vehicle_model;
        const engine = (
          await post('/admin/engines', {
            code: 'B47D20O1',
            family: 'B47',
            fuel: 'diesel',
            displacement_cc: 1995,
          })
        ).data.engine;
        const vehicle = (
          await post('/admin/vehicles', {
            model_id: model.id,
            engine_id: engine.id,
            power_kw: 140,
            drive: 'rwd',
            steering: 'left',
          })
        ).data.vehicle;
        const identifier = await post('/admin/vehicle-identifiers', {
          vehicle_id: vehicle.id,
          type: 'bmw-type-code',
          value: 'jc31',
        });

        expect(chassis.code).toBe('G30');
        expect(identifier.data.vehicle_identifier).toMatchObject({
          value: 'JC31',
          created_by: expect.stringMatching(/^user_/),
        });
        const listed = await api.get('/admin/vehicles', adminHeaders);
        expect(listed.data.vehicles).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: vehicle.id,
              identifiers: [expect.objectContaining({ value: 'JC31' })],
            }),
          ]),
        );
      });

      it('updates a reference row', async () => {
        const { engine } = await createVehicleFixture(catalog, {
          typeCode: 'UPD1',
        });

        const response = await post(`/admin/engines/${engine.id}`, {
          displacement_cc: 1998,
        });

        expect(response.data.engine).toMatchObject({
          id: engine.id,
          displacement_cc: 1998,
        });
      });

      it('refuses a type code another Vehicle already holds', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'DUP1',
        });

        const response = await post('/admin/vehicle-identifiers', {
          vehicle_id: vehicle.id,
          type: 'bmw-type-code',
          value: 'dup1',
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'vehicle_identifier',
        });
      });

      it.each([
        ['a BMW type code of five characters', 'bmw-type-code', '35BGX'],
        ['a Baumuster with letters', 'mercedes-baumuster', '213O04'],
      ])('names the value for %s', async (_, type, value) => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'FMT1',
        });

        const response = await post('/admin/vehicle-identifiers', {
          vehicle_id: vehicle.id,
          type,
          value,
        });

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_FIELD',
          field: 'value',
        });
      });

      it('refuses a Chassis whose years run backwards', async () => {
        const { chassis } = await createVehicleFixture(catalog, {
          typeCode: 'YRS1',
        });

        const created = await post('/admin/chassis', {
          series_id: chassis.series_id,
          code: 'E90',
          body_style: 'sedan',
          year_from: 2012,
          year_to: 2005,
        });
        const updated = await post(`/admin/chassis/${chassis.id}`, {
          year_from: 2019,
          year_to: 2011,
        });

        expect(created.data.field).toBe('year_to');
        expect(updated.data.field).toBe('year_to');
      });

      it('checks a partial update against the stored row', async () => {
        const { chassis, vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'MRG1',
          chassisCode: 'MRG-CHASSIS',
        });
        const [identifier] = await catalog.listVehicleIdentifiers({
          vehicle_id: vehicle.id,
        });

        const refused = await Promise.all([
          post(`/admin/chassis/${chassis.id}`, { year_to: 2005 }),
          post(`/admin/vehicles/${vehicle.id}`, { year_from: 2025 }),
          post(`/admin/vehicle-identifiers/${identifier.id}`, {
            value: 'MRG12',
          }),
          post(`/admin/vehicle-identifiers/${identifier.id}`, {
            type: 'mercedes-baumuster',
          }),
        ]);

        expect(refused.map(({ status, data }) => [status, data.field])).toEqual(
          [
            [400, 'year_to'],
            [400, 'year_to'],
            [400, 'value'],
            [400, 'value'],
          ],
        );
        expect(await catalog.retrieveChassis(chassis.id)).toMatchObject({
          year_to: 2019,
        });
        expect(await catalog.retrieveVehicle(vehicle.id)).toMatchObject({
          year_from: 2015,
        });
        expect(
          (await post(`/admin/vehicles/${vehicle.id}`, { year_from: 2016 }))
            .status,
        ).toBe(200);
      });

      it('stores one of two identical Vehicles sent at once', async () => {
        const { model, engine } = await createVehicleFixture(catalog, {
          typeCode: 'TWIN',
        });
        const body = {
          model_id: model.id,
          engine_id: engine.id,
          power_kw: 120,
          market: 'EU',
          year_from: 2016,
        };

        const responses = await Promise.all([
          post('/admin/vehicles', body),
          post('/admin/vehicles', body),
        ]);

        expect(responses.map(({ status }) => status).sort()).toEqual([
          200, 409,
        ]);
        expect(responses.find(({ status }) => status === 409)?.data).toEqual(
          expect.objectContaining({
            code: 'ALREADY_EXISTS',
            entity: 'vehicle',
            message: 'This vehicle already exists.',
          }),
        );
      });

      it('refuses a Make name that differs from a stored one only by case', async () => {
        await post('/admin/makes', { slug: 'skoda', name: 'Skoda' });

        const response = await post('/admin/makes', {
          slug: 'skoda-2',
          name: ' SKODA ',
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'make',
          message: 'This make already exists.',
        });
      });

      it('refuses a second Series of the same name under one Make', async () => {
        const { make } = await createVehicleFixture(catalog, {
          typeCode: 'SER1',
        });

        const response = await post('/admin/series', {
          make_id: make.id,
          name: '3 СЕРИЯ',
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'series',
        });
      });

      it('refuses a Series translation in a locale the catalogue does not have', async () => {
        const { make } = await createVehicleFixture(catalog, {
          typeCode: 'SER2',
        });

        const response = await post('/admin/series', {
          make_id: make.id,
          name: '1 серия',
          translations: { de: '1er' },
        });

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_FIELD',
          field: 'translations',
        });
      });

      it('names what still holds a Make it refuses to delete', async () => {
        const { make } = await createVehicleFixture(catalog, {
          typeCode: 'HLD1',
        });

        const response = await remove(`/admin/makes/${make.id}`);

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'IN_USE',
          holders: [{ entity: 'series', count: 1 }],
        });
      });

      it('refuses a Make name past 200 characters', async () => {
        const response = await post('/admin/makes', {
          slug: 'long-make',
          name: 'M'.repeat(201),
        });

        expect(response.status).toBe(400);
        expect(response.data.field).toBe('name');
      });

      it('refuses to delete a Model that still has Vehicles', async () => {
        const { model } = await createVehicleFixture(catalog, {
          typeCode: 'REF1',
          modelSlug: 'f31-320d',
        });

        const response = await remove(`/admin/vehicle-models/${model.id}`);

        expect(response.status).toBe(409);
        expect(response.data.code).toBe('IN_USE');
        expect(await catalog.listVehicleModels({ id: model.id })).toHaveLength(
          1,
        );
      });

      it('deletes a Vehicle with its identifiers and Fitments but keeps the Part', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'DEL1',
        });
        const part = await catalog.createParts({ name: 'Kept part' });
        const fitment = await catalog.createFitments({
          part_id: part.id,
          vehicle_id: vehicle.id,
        });

        const response = await remove(`/admin/vehicles/${vehicle.id}`);

        expect(response.data).toEqual({
          id: vehicle.id,
          object: 'vehicle',
          deleted: true,
        });
        expect(
          await catalog.listVehicleIdentifiers({ vehicle_id: vehicle.id }),
        ).toHaveLength(0);
        expect(await catalog.listFitments({ id: fitment.id })).toHaveLength(0);
        expect(await catalog.listParts({ id: part.id })).toHaveLength(1);
      });

      it('returns a 404 for an unknown Vehicle', async () => {
        const response = await remove('/admin/vehicles/vehicle_missing');

        expect(response.status).toBe(404);
      });

      it('returns a 400 for a Vehicle identifier outside the known vocabularies', async () => {
        const response = await post('/admin/vehicle-identifiers', {
          vehicle_id: 'vehicle_any',
          type: 'ktype',
          value: '1234',
        });

        expect(response.status).toBe(400);
      });
    });
  },
});
