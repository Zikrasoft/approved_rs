import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
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
        const vehicle = await catalog.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: engineCode,
          year_from: 2015,
          year_to: 2018,
        });
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
