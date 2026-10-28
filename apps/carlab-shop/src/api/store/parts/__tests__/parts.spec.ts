import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/parts/:id', () => {
      let partId: string;
      let oemIdentifierId: string;
      let mannIdentifierId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const supplierService: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);

        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'part-detail-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        const [intercars, carlabWarehouse] =
          await supplierService.createSuppliers([
            { name: 'Intercars', markup_percentage: 20.15 },
            { name: 'CarLab warehouse', markup_percentage: 15 },
          ]);

        const [bmw, mann] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);

        const part = await catalog.createParts({
          name: 'Oil filter, BMW B47/B48 engines',
        });
        partId = part.id;

        const oemIdentifier = await catalog.createPartIdentifiers({
          part_id: partId,
          type: 'oem',
          brand_id: bmw.id,
          value: '11 42 8575211',
          normalized_value: normalizePartNumber('11 42 8575211'),
        });
        oemIdentifierId = oemIdentifier.id;

        const mannIdentifier = await catalog.createPartIdentifiers({
          part_id: partId,
          type: 'manufacturer-number',
          brand_id: mann.id,
          value: 'HU 816 x',
          normalized_value: normalizePartNumber('HU 816 x'),
        });
        mannIdentifierId = mannIdentifier.id;

        await supplierService.createSupplierOffers([
          {
            part_identifier_id: oemIdentifierId,
            supplier_id: intercars.id,
            supplier_article_id: 'IC-11428575211',
            cost_price: 1542,
            stock_quantity: 12,
            lead_time_days: 0,
          },
          {
            part_identifier_id: mannIdentifierId,
            supplier_id: intercars.id,
            supplier_article_id: 'IC-HU816X',
            cost_price: 1000,
            stock_quantity: 30,
            lead_time_days: 0,
          },
          {
            part_identifier_id: mannIdentifierId,
            supplier_id: carlabWarehouse.id,
            supplier_article_id: 'WH-HU816X',
            cost_price: 1000,
            stock_quantity: 4,
            lead_time_days: 3,
          },
        ]);
      });

      it('returns the part with its identifiers and their supplier offers', async () => {
        const response = await api.get(`/store/parts/${partId}`, storeHeaders);

        expect(response.status).toBe(200);
        expect(response.data.part).toMatchObject({
          id: partId,
          name: 'Oil filter, BMW B47/B48 engines',
        });

        const identifiers = response.data.part.identifiers;
        expect(identifiers).toHaveLength(2);

        const oem = identifiers.find(
          (identifier: { id: string }) => identifier.id === oemIdentifierId,
        );
        expect(oem).toMatchObject({
          type: 'oem',
          brand: 'BMW',
          value: '11 42 8575211',
        });
        expect(oem.offers).toEqual([
          {
            id: expect.any(String),
            price: 1853,
            currency: 'RSD',
            stock_quantity: 12,
            lead_time_days: 0,
          },
        ]);

        const mann = identifiers.find(
          (identifier: { id: string }) => identifier.id === mannIdentifierId,
        );
        expect(mann.type).toBe('manufacturer-number');
        expect(mann.brand).toBe('Mann-Filter');
        expect(mann.offers).toHaveLength(2);
      });

      it('never includes a cost price or markup field in the response', async () => {
        const response = await api.get(`/store/parts/${partId}`, storeHeaders);

        const raw = JSON.stringify(response.data);
        expect(raw).not.toMatch(/cost_price|markup|supplier|Intercars/i);
      });
    });
  },
});
