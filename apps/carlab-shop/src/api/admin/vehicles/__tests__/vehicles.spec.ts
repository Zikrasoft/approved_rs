import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const ADMIN_EMAIL = 'admin@vehicles-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin vehicle picker', () => {
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

      describe('GET /admin/vehicles', () => {
        it('lists the seeded vehicles for the picker, pick-only', async () => {
          const vehicle = await catalog.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47',
            year_from: 2015,
            year_to: 2018,
          });

          const response = await api.get('/admin/vehicles', adminHeaders);

          expect(response.status).toBe(200);
          expect(response.data.vehicles).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: vehicle.id, make: 'BMW' }),
            ]),
          );
        });
      });

      it('has no admin endpoint to create a Vehicle ad-hoc', async () => {
        await expect(
          api.post(
            '/admin/vehicles',
            { make: 'Ad-hoc', model: 'Should not exist', engine_code: 'X' },
            adminHeaders,
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      describe('DELETE /admin/vehicles/:id', () => {
        it('removes the Vehicle with its identifiers and Fitments but keeps the Part', async () => {
          const vehicle = await catalog.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47-DELETE',
          });
          const identifier = await catalog.createVehicleIdentifiers({
            vehicle_id: vehicle.id,
            type: 'oem-type-code',
            value: '8C31-DELETE',
          });
          const part = await catalog.createParts({ name: 'Kept part' });
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });

          const response = await api.delete(
            `/admin/vehicles/${vehicle.id}`,
            adminHeaders,
          );

          expect(response.data).toEqual({
            id: vehicle.id,
            object: 'vehicle',
            deleted: true,
          });
          expect(await catalog.listVehicles({ id: vehicle.id })).toHaveLength(
            0,
          );
          expect(
            await catalog.listVehicleIdentifiers({ id: identifier.id }),
          ).toHaveLength(0);
          expect(await catalog.listFitments({ id: fitment.id })).toHaveLength(
            0,
          );
          expect(await catalog.listParts({ id: part.id })).toHaveLength(1);
        });

        it('returns a 404 for an unknown Vehicle', async () => {
          const response = await api
            .delete('/admin/vehicles/vehicle_missing', adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });
    });
  },
});
