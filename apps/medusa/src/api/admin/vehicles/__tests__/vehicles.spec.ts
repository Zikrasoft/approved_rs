import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { VEHICLE_MODULE } from '../../../../modules/vehicle';
import type VehicleModuleService from '../../../../modules/vehicle/service';

const ADMIN_EMAIL = 'admin@vehicles-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'vehicle',
  testSuite: ({ api, getContainer }) => {
    describe('admin vehicle picker', () => {
      let adminHeaders: { headers: { authorization: string } };
      let vehicleModuleService: VehicleModuleService;

      beforeAll(async () => {
        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      describe('GET /admin/vehicles', () => {
        it('lists the seeded vehicles for the picker, pick-only', async () => {
          const vehicle = await vehicleModuleService.createVehicles({
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
    });
  },
});
