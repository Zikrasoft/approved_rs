import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { updateSupplierOfferWorkflow } from '../../../../workflows/update-supplier-offer';

medusaIntegrationTestRunner({
  moduleName: 'part',
  dbName: 'medusa-search-typesense-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search', () => {
      let partId: string;
      let oemOfferId: string;
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };

      beforeAll(async () => {
        const partModuleService: PartModuleService =
          getContainer().resolve(PART_MODULE);
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);

        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'search-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        const [intercars] = await partModuleService.createSuppliers([
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
          value: '11 42 8575211',
        });

        const mannIdentifier = await partModuleService.createPartIdentifiers({
          part_id: partId,
          type: 'manufacturer-number',
          brand: 'Mann-Filter',
          value: 'HU 816 x',
        });

        const [oemOffer] = await partModuleService.createSupplierOffers([
          {
            identifier_id: oemIdentifier.id,
            supplier_id: intercars.id,
            supplier_article_id: 'IC-11428575211',
            cost_price: 1542,
            stock_quantity: 12,
            lead_time: 'in_stock',
          },
          {
            identifier_id: mannIdentifier.id,
            supplier_id: intercars.id,
            supplier_article_id: 'IC-HU816X',
            cost_price: 1000,
            stock_quantity: 30,
            lead_time: 'in_stock',
          },
        ]);
        oemOfferId = oemOffer.id;

        const searchModuleService = getContainer().resolve(Modules.SEARCH);
        await searchModuleService.reindex({ index: 'part' });
      });

      it('resolves a spaced OEM number to the one canonical Part', async () => {
        const response = await api.get(
          '/store/search?q=' + encodeURIComponent('11 42 8575211'),
          storeHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.part).toMatchObject({ id: partId });
      });

      it('resolves the same OEM number with punctuation stripped', async () => {
        const response = await api.get(
          '/store/search?q=' + encodeURIComponent('1142 8575211'),
          storeHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.part.id).toBe(partId);
      });

      it('resolves a manufacturer-brand number, with or without spacing, to the same Part', async () => {
        const spaced = await api.get(
          '/store/search?q=' + encodeURIComponent('HU 816 x'),
          storeHeaders,
        );
        const compact = await api.get(
          '/store/search?q=' + encodeURIComponent('hu816x'),
          storeHeaders,
        );

        expect(spaced.data.part.id).toBe(partId);
        expect(compact.data.part.id).toBe(partId);
        expect(spaced.data.part.id).toBe(compact.data.part.id);
      });

      it('reflects a changed SupplierOffer price without a manual reindex', async () => {
        const container = getContainer();

        await updateSupplierOfferWorkflow(container).run({
          input: { id: oemOfferId, cost_price: 2000 },
        });

        const response = await api.get(
          '/store/search?q=' + encodeURIComponent('11428575211'),
          storeHeaders,
        );

        const oem = response.data.part.identifiers.find(
          (identifier: { type: string }) => identifier.type === 'oem',
        );
        const offer = oem.offers.find(
          (candidate: { id: string }) => candidate.id === oemOfferId,
        );

        expect(offer.price).toBe(2400);
      });

      it('never duplicates a Part per brand-variant identifier', async () => {
        const response = await api.get(
          '/store/search?q=' + encodeURIComponent('HU 816 x'),
          storeHeaders,
        );

        expect(response.data.part.identifiers).toHaveLength(2);
        const types = response.data.part.identifiers.map(
          (identifier: { type: string }) => identifier.type,
        );
        expect(types.sort()).toEqual(['manufacturer-number', 'oem']);
      });

      it('returns 404 for a value that matches no Part', async () => {
        const response = await api
          .get(
            '/store/search?q=' + encodeURIComponent('does-not-exist-9999'),
            storeHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });
    });
  },
});
