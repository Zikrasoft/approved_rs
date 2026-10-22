import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const ADMIN_EMAIL = 'admin@fitments-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin fitment curation', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      const createPartAndVehicle = async (engineCode: string) => {
        const part = await catalog.createParts({
          name: `Admin-test part ${engineCode}`,
        });
        const vehicle = (
          await createVehicleFixture(catalog, { typeCode: engineCode })
        ).vehicle;
        return { part, vehicle };
      };

      describe('POST /admin/fitments', () => {
        it('creates a manual Fitment stamped with the admin who made it', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-CREATE');

          const response = await api.post(
            '/admin/fitments',
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              steering: 'left',
              gearbox: 'manual',
            },
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.fitment).toMatchObject({
            part_id: part.id,
            vehicle_id: vehicle.id,
            steering: 'left',
            gearbox: 'manual',
            source: 'manual',
            created_by: expect.stringMatching(/^user_/),
          });
          expect(response.data.fitment.updated_by).toBe(
            response.data.fitment.created_by,
          );
        });

        it('refuses a client-supplied source with a 400', async () => {
          const { part, vehicle } = await createPartAndVehicle('B48-SOURCE');

          const response = await api
            .post(
              '/admin/fitments',
              { part_id: part.id, vehicle_id: vehicle.id, source: 'auto:x' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('returns a 400 for a steering side that does not exist', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-BAD');

          const response = await api
            .post(
              '/admin/fitments',
              { part_id: part.id, vehicle_id: vehicle.id, steering: 'middle' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('returns a 400 when the Part is missing from the body', async () => {
          const { vehicle } = await createPartAndVehicle('B47-NO-PART');

          const response = await api
            .post('/admin/fitments', { vehicle_id: vehicle.id }, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('returns a 404 for an unknown Vehicle', async () => {
          const { part } = await createPartAndVehicle('B47-UNKNOWN-VEHICLE');

          const response = await api
            .post(
              '/admin/fitments',
              { part_id: part.id, vehicle_id: 'vehicle_missing' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });

        it('returns a 404 for an unknown Part', async () => {
          const { vehicle } = await createPartAndVehicle('B47-UNKNOWN-PART');

          const response = await api
            .post(
              '/admin/fitments',
              { part_id: 'part_missing', vehicle_id: vehicle.id },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });

      describe('Fitment conditions', () => {
        it('stores quantity, position and a note', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-PADS');

          const response = await api.post(
            '/admin/fitments',
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              quantity: 4,
              axle: 'front',
              side: 'left',
              gearbox: 'automatic',
              note: 'Только с M-пакетом',
            },
            adminHeaders,
          );

          expect(response.data.fitment).toMatchObject({
            quantity: 4,
            axle: 'front',
            side: 'left',
            gearbox: 'automatic',
            note: 'Только с M-пакетом',
          });
        });

        it('takes one as the quantity when none is given', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-ONE');

          const response = await api.post(
            '/admin/fitments',
            { part_id: part.id, vehicle_id: vehicle.id },
            adminHeaders,
          );

          expect(response.data.fitment.quantity).toBe(1);
        });

        it('refuses a second Fitment with the same position and criteria', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-TWICE');
          const body = { part_id: part.id, vehicle_id: vehicle.id };
          await api.post('/admin/fitments', body, adminHeaders);

          const response = await api
            .post('/admin/fitments', { ...body, quantity: 2 }, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(409);
          expect(response.data.code).toBe('DUPLICATE_FITMENT');
          expect(
            await catalog.listFitments({
              part_id: part.id,
              vehicle_id: vehicle.id,
            }),
          ).toHaveLength(1);
        });

        it('accepts the same Part at another position', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-AXLES');
          const body = { part_id: part.id, vehicle_id: vehicle.id };
          await api.post(
            '/admin/fitments',
            { ...body, axle: 'front' },
            adminHeaders,
          );

          const response = await api.post(
            '/admin/fitments',
            { ...body, axle: 'rear' },
            adminHeaders,
          );

          expect(response.status).toBe(200);
        });

        it('returns a 400 for a quantity below one', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-ZERO');

          const response = await api
            .post(
              '/admin/fitments',
              { part_id: part.id, vehicle_id: vehicle.id, quantity: 0 },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });
      });

      describe('POST /admin/fitments/bulk', () => {
        const createFamily = async (tag: string) => {
          const f30b47 = await createVehicleFixture(catalog, {
            typeCode: `${tag}-1`,
            modelSlug: `${tag.toLowerCase()}-f30-320d`,
            chassisCode: `${tag}-F30`,
            engineCode: `${tag}-B47D20O0`,
            engineFamily: `${tag}-B47`,
          });
          const f30b47Again = await createVehicleFixture(catalog, {
            typeCode: `${tag}-2`,
            modelSlug: `${tag.toLowerCase()}-f30-320d`,
            chassisCode: `${tag}-F30`,
            engineCode: `${tag}-B47D20U0`,
            engineFamily: `${tag}-B47`,
          });
          const f30b48 = await createVehicleFixture(catalog, {
            typeCode: `${tag}-3`,
            modelSlug: `${tag.toLowerCase()}-f30-330i`,
            chassisCode: `${tag}-F30`,
            engineCode: `${tag}-B48B20`,
            engineFamily: `${tag}-B48`,
          });
          const g20b47 = await createVehicleFixture(catalog, {
            typeCode: `${tag}-4`,
            modelSlug: `${tag.toLowerCase()}-g20-320d`,
            chassisCode: `${tag}-G20`,
            engineCode: `${tag}-B47D20O0`,
            engineFamily: `${tag}-B47`,
          });
          const part = await catalog.createParts({ name: 'Bulk oil filter' });
          return { f30b47, f30b47Again, f30b48, g20b47, part };
        };

        it('attaches a Part to every Vehicle of a Chassis and engine family, once', async () => {
          const { f30b47, f30b47Again, part } = await createFamily('FAM');
          const body = {
            part_id: part.id,
            chassis_id: f30b47.chassis.id,
            engine_family: 'FAM-B47',
            quantity: 1,
          };

          const first = await api.post(
            '/admin/fitments/bulk',
            body,
            adminHeaders,
          );
          const repeat = await api.post(
            '/admin/fitments/bulk',
            body,
            adminHeaders,
          );

          expect(first.data).toEqual({ matched: 2, created: 2 });
          expect(repeat.data).toEqual({ matched: 2, created: 0 });
          const fitments = await catalog.listFitments({ part_id: part.id });
          expect(fitments.map(({ vehicle_id }) => vehicle_id).sort()).toEqual(
            [f30b47.vehicle.id, f30b47Again.vehicle.id].sort(),
          );
          expect(fitments[0].created_by).toMatch(/^user_/);
        });

        it('narrows by Model, Engine and years', async () => {
          const { f30b48, g20b47, part } = await createFamily('NARROW');
          await catalog.updateVehicles({
            id: g20b47.vehicle.id,
            year_from: 2019,
            year_to: null,
          });

          const byModel = await api.post(
            '/admin/fitments/bulk',
            { part_id: part.id, model_id: f30b48.model.id },
            adminHeaders,
          );
          const byEngineAndYears = await api.post(
            '/admin/fitments/bulk',
            {
              part_id: part.id,
              engine_id: g20b47.engine.id,
              year_from: 2020,
              axle: 'front',
            },
            adminHeaders,
          );

          expect(byModel.data).toEqual({ matched: 1, created: 1 });
          expect(byEngineAndYears.data).toEqual({ matched: 1, created: 1 });
          expect(
            await catalog.listFitments({
              part_id: part.id,
              vehicle_id: g20b47.vehicle.id,
            }),
          ).toEqual([expect.objectContaining({ axle: 'front' })]);
        });

        it('attaches to every Vehicle of a Make', async () => {
          const make = await catalog.createMakes({
            slug: 'bulk-make',
            name: 'Bulk Make',
          });
          const part = await catalog.createParts({ name: 'Make-wide part' });
          await createVehicleFixture(catalog, {
            make: { slug: 'bulk-make', name: 'Bulk Make' },
            typeCode: 'BULK-MAKE-1',
            modelSlug: 'bulk-make-model',
            chassisCode: 'BULK-MAKE-CHASSIS',
          });

          const response = await api.post(
            '/admin/fitments/bulk',
            { part_id: part.id, make_id: make.id },
            adminHeaders,
          );

          expect(response.data).toEqual({ matched: 1, created: 1 });
        });

        it('matches an engine family typed in lower case', async () => {
          const { part } = await createFamily('LOWER');

          const response = await api.post(
            '/admin/fitments/bulk',
            { part_id: part.id, engine_family: 'lower-b47' },
            adminHeaders,
          );

          expect(response.data).toEqual({ matched: 3, created: 3 });
        });

        it('names the field when the years run backwards', async () => {
          const part = await catalog.createParts({ name: 'Backwards part' });

          const response = await api
            .post(
              '/admin/fitments/bulk',
              { part_id: part.id, year_from: 2020, year_to: 2010 },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data).toMatchObject({
            code: 'INVALID_FIELD',
            field: 'year_to',
          });
        });

        it('undoes a wrong bulk attach with the same filter', async () => {
          const { f30b47, f30b48, part } = await createFamily('UNDO');
          const kept = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: f30b48.vehicle.id,
          });
          const filter = {
            part_id: part.id,
            chassis_id: f30b47.chassis.id,
            engine_family: 'UNDO-B47',
          };
          await api.post(
            '/admin/fitments/bulk',
            { ...filter, axle: 'front' },
            adminHeaders,
          );

          const response = await api.post(
            '/admin/fitments/bulk/delete',
            filter,
            adminHeaders,
          );

          expect(response.data).toEqual({ matched: 2, deleted: 2 });
          expect(
            (await catalog.listFitments({ part_id: part.id })).map(
              ({ id }) => id,
            ),
          ).toEqual([kept.id]);
        });

        it('returns a 400 without any Vehicle filter', async () => {
          const part = await catalog.createParts({ name: 'Unfiltered part' });

          const response = await api
            .post('/admin/fitments/bulk', { part_id: part.id }, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('returns a 404 for an unknown Part', async () => {
          const { f30b47 } = await createFamily('MISSING');

          const response = await api
            .post(
              '/admin/fitments/bulk',
              { part_id: 'part_missing', model_id: f30b47.model.id },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });

      describe('/admin/fitments/:id', () => {
        it('changes the conditions of a Fitment and stamps the editor', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-EDIT');
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });

          const response = await api.post(
            `/admin/fitments/${fitment.id}`,
            { axle: 'rear', quantity: 2, note: 'Только седан' },
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.fitment).toMatchObject({
            id: fitment.id,
            axle: 'rear',
            quantity: 2,
            note: 'Только седан',
            updated_by: expect.stringMatching(/^user_/),
          });
        });

        it('refuses a production period that ends before it starts', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-PERIOD');
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });

          const response = await api
            .post(
              `/admin/fitments/${fitment.id}`,
              {
                production_from: '2020-01-01',
                production_to: '2015-01-01',
              },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data.field).toBe('production_to');
        });

        it('checks a partial period change against the stored dates', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-MERGE');
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
            production_from: new Date('2020-01-01'),
          });

          const response = await api
            .post(
              `/admin/fitments/${fitment.id}`,
              { production_to: '2015-01-01' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data.field).toBe('production_to');
          expect(
            (await catalog.retrieveFitment(fitment.id)).production_to,
          ).toBeNull();
        });

        it('names the field of a date that is not a date', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-BADDATE');
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });

          const response = await api
            .post(
              `/admin/fitments/${fitment.id}`,
              { production_from: 'not-a-date' },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data).toMatchObject({
            code: 'INVALID_FIELD',
            field: 'production_from',
            message: 'production_from: Not a date',
          });
        });

        it('deletes a Fitment', async () => {
          const { part, vehicle } = await createPartAndVehicle('B47-DELETE');
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });

          const response = await api.delete(
            `/admin/fitments/${fitment.id}`,
            adminHeaders,
          );

          expect(response.data).toEqual({
            id: fitment.id,
            object: 'fitment',
            deleted: true,
          });
          expect(await catalog.listFitments({ id: fitment.id })).toEqual([]);
        });

        it('returns a 404 for an unknown Fitment', async () => {
          const response = await api
            .delete('/admin/fitments/fit_missing', adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });

      it('has no endpoint to reject a Fitment', async () => {
        const { part, vehicle } = await createPartAndVehicle('B47-REJECT');
        const fitment = await catalog.createFitments({
          part_id: part.id,
          vehicle_id: vehicle.id,
        });

        const response = await api
          .post(`/admin/fitments/${fitment.id}/reject`, {}, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });
    });
  },
});
