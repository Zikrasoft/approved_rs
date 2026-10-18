import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../../modules/vehicle';
import type VehicleModuleService from '../../../../modules/vehicle/service';

medusaIntegrationTestRunner({
  moduleName: 'vehicle',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search with vehicle_id', () => {
      let partId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let vehicleModuleService: VehicleModuleService;
      let fittingVehicleId: string;
      let unrelatedVehicleId: string;
      let rejectedVehicleId: string;
      let ambiguousVehicleId: string;

      const q = '13 71 8511877';

      beforeAll(async () => {
        const partModuleService: PartModuleService =
          getContainer().resolve(PART_MODULE);
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);

        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'vehicle-search-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        const [supplier] = await partModuleService.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
        ]);

        const part = await partModuleService.createParts({
          name: 'Oil filter, BMW B47/B48 engines',
        });
        partId = part.id;

        const oemIdentifier = await partModuleService.createPartIdentifiers({
          part_id: partId,
          type: 'oem',
          brand: 'BMW',
          value: q,
        });

        await partModuleService.createSupplierOffers([
          {
            identifier_id: oemIdentifier.id,
            supplier_id: supplier.id,
            supplier_article_id: 'IC-13718511877',
            cost_price: 1200,
            stock_quantity: 10,
            lead_time: 'in_stock',
          },
        ]);

        const fittingVehicle = await vehicleModuleService.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: 'B47',
          year_from: 2015,
          year_to: 2018,
        });
        fittingVehicleId = fittingVehicle.id;
        await vehicleModuleService.createFitments({
          part_id: partId,
          vehicle_id: fittingVehicleId,
          source: 'manual',
          status: 'active',
        });

        const unrelatedVehicle = await vehicleModuleService.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: 'N20',
          year_from: 2012,
          year_to: 2015,
        });
        unrelatedVehicleId = unrelatedVehicle.id;

        const rejectedVehicle = await vehicleModuleService.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: 'B48',
          year_from: 2018,
          year_to: 2021,
        });
        rejectedVehicleId = rejectedVehicle.id;
        await vehicleModuleService.createFitments({
          part_id: partId,
          vehicle_id: rejectedVehicleId,
          source: 'manual',
          status: 'rejected',
        });

        const ambiguousVehicle = await vehicleModuleService.createVehicles({
          make: 'BMW',
          model: '320d (F30)',
          engine_code: 'N47',
          year_from: 2010,
          year_to: 2012,
        });
        ambiguousVehicleId = ambiguousVehicle.id;
        await vehicleModuleService.createFitments([
          {
            part_id: partId,
            vehicle_id: ambiguousVehicleId,
            steering: 'left',
            source: 'manual',
            status: 'active',
          },
          {
            part_id: partId,
            vehicle_id: ambiguousVehicleId,
            steering: 'right',
            source: 'manual',
            status: 'active',
          },
        ]);

        const searchModuleService = getContainer().resolve(Modules.SEARCH);
        await searchModuleService.reindex({ index: 'part' });
      });

      it('returns the Part when the selected Vehicle has an active Fitment for it', async () => {
        const response = await api.get(
          `/store/search?q=${encodeURIComponent(q)}&vehicle_id=${fittingVehicleId}`,
          storeHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.part.id).toBe(partId);
      });

      it('ignores the vehicle filter when no Vehicle is selected', async () => {
        const response = await api.get(
          `/store/search?q=${encodeURIComponent(q)}`,
          storeHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.part.id).toBe(partId);
      });

      it('excludes the Part for a Vehicle with no Fitment row for it', async () => {
        const response = await api
          .get(
            `/store/search?q=${encodeURIComponent(q)}&vehicle_id=${unrelatedVehicleId}`,
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });

      it('excludes the Part for a Vehicle whose only Fitment row was rejected', async () => {
        const response = await api
          .get(
            `/store/search?q=${encodeURIComponent(q)}&vehicle_id=${rejectedVehicleId}`,
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });

      it('returns the Part once for a Vehicle with multiple active (ambiguous) Fitment rows', async () => {
        const response = await api.get(
          `/store/search?q=${encodeURIComponent(q)}&vehicle_id=${ambiguousVehicleId}`,
          storeHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.part.id).toBe(partId);
      });

      it('returns 404 for an unknown vehicle_id', async () => {
        const response = await api
          .get(
            `/store/search?q=${encodeURIComponent(q)}&vehicle_id=vehicle_missing`,
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });
    });
  },
});
