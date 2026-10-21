import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search with vehicle_id', () => {
      let partId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let fittingVehicleId: string;
      let unrelatedVehicleId: string;
      let ambiguousVehicleId: string;

      const q = '13 71 8511877';

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const supplierService: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);

        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'vehicle-search-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        const [supplier] = await supplierService.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
        ]);

        const part = await catalog.createParts({
          name: 'Oil filter, BMW B47/B48 engines',
        });
        partId = part.id;

        const oemIdentifier = await catalog.createPartIdentifiers({
          part_id: partId,
          type: 'oem',
          brand: 'BMW',
          value: q,
        });

        await supplierService.createSupplierOffers([
          {
            part_identifier_id: oemIdentifier.id,
            supplier_id: supplier.id,
            supplier_article_id: 'IC-13718511877',
            cost_price: 1200,
            stock_quantity: 10,
            lead_time: 'in_stock',
          },
        ]);

        const fittingVehicle = (
          await createVehicleFixture(catalog, { typeCode: 'T001' })
        ).vehicle;
        fittingVehicleId = fittingVehicle.id;
        await catalog.createFitments({
          part_id: partId,
          vehicle_id: fittingVehicleId,
        });

        const unrelatedVehicle = (
          await createVehicleFixture(catalog, { typeCode: 'T002' })
        ).vehicle;
        unrelatedVehicleId = unrelatedVehicle.id;

        const ambiguousVehicle = (
          await createVehicleFixture(catalog, { typeCode: 'T003' })
        ).vehicle;
        ambiguousVehicleId = ambiguousVehicle.id;
        await catalog.createFitments([
          {
            part_id: partId,
            vehicle_id: ambiguousVehicleId,
            steering: 'left',
          },
          {
            part_id: partId,
            vehicle_id: ambiguousVehicleId,
            steering: 'right',
          },
        ]);

        const searchModuleService = getContainer().resolve(Modules.SEARCH);
        await searchModuleService.reindex({ index: 'part' });
      });

      it('returns the Part when the selected Vehicle has a Fitment for it', async () => {
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

      it('returns the Part once for a Vehicle with multiple (ambiguous) Fitment rows', async () => {
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
