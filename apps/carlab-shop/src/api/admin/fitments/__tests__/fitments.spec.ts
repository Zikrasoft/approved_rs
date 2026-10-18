import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../../modules/vehicle';
import type VehicleModuleService from '../../../../modules/vehicle/service';

const ADMIN_EMAIL = 'admin@fitments-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'vehicle',
  testSuite: ({ api, getContainer }) => {
    describe('admin fitment curation', () => {
      let adminHeaders: { headers: { authorization: string } };
      let partModuleService: PartModuleService;
      let vehicleModuleService: VehicleModuleService;

      beforeAll(async () => {
        partModuleService = getContainer().resolve(PART_MODULE);
        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      describe('POST /admin/fitments', () => {
        it('creates a manual, active Fitment row for the Part/Vehicle pair', async () => {
          const part = await partModuleService.createParts({
            name: 'Admin-test fitment part',
          });
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47-FITMENT-TEST',
            year_from: 2015,
            year_to: 2018,
          });

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
            status: 'active',
          });

          const fitment = await vehicleModuleService.retrieveFitment(
            response.data.fitment.id,
          );
          expect(fitment.source).toBe('manual');
          expect(fitment.status).toBe('active');
        });

        it('ignores a client-supplied source/status and forces manual/active', async () => {
          const part = await partModuleService.createParts({
            name: 'Admin-test fitment forced-source part',
          });
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B48-FITMENT-FORCE-TEST',
            year_from: 2018,
            year_to: 2021,
          });

          const response = await api.post(
            '/admin/fitments',
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              source: 'auto:tecdoc',
              status: 'rejected',
            },
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.fitment).toMatchObject({
            source: 'manual',
            status: 'active',
          });
        });

        it('returns a 404 for an unknown Vehicle', async () => {
          const part = await partModuleService.createParts({
            name: 'Admin-test fitment unknown-vehicle part',
          });

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
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47-UNKNOWN-PART-TEST',
            year_from: 2015,
            year_to: 2018,
          });

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

      describe('POST /admin/fitments/:id/reject', () => {
        it('flips an existing Fitment row to rejected without deleting it', async () => {
          const part = await partModuleService.createParts({
            name: 'Admin-test reject part',
          });
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47-REJECT-TEST',
            year_from: 2015,
            year_to: 2018,
          });
          const fitment = await vehicleModuleService.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
            source: 'auto:tecdoc',
            status: 'active',
          });

          const response = await api.post(
            `/admin/fitments/${fitment.id}/reject`,
            {},
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.fitment).toMatchObject({
            id: fitment.id,
            status: 'rejected',
            source: 'auto:tecdoc',
          });

          const stillExists = await vehicleModuleService.retrieveFitment(
            fitment.id,
          );
          expect(stillExists.id).toBe(fitment.id);
          expect(stillExists.status).toBe('rejected');
        });

        it('returns a 404 for an unknown Fitment', async () => {
          const response = await api
            .post('/admin/fitments/fitment_missing/reject', {}, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });
    });
  },
});
