import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../../integration-tests/fakeShopAi';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { SHOP_AI_REGISTRATION } from '../../../../lib/ai';
import { bmwTypeCodeDecoder } from '../../../../lib/vin/bmw-type-code';
import { VIN_DECODERS_REGISTRATION } from '../../../../lib/vin/chain';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const OWNER_VIN = 'WBA35BG070N074158';
const UNKNOWN_VIN = 'WBA99ZZ070N000001';
const QUOTE_PDF = Buffer.from('%PDF-1.4\n% ponuda\n%%EOF\n');

const ai = createFakeShopAi();

medusaIntegrationTestRunner({
  moduleName: 'workshop_quotes',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(SHOP_AI_REGISTRATION, asValue(ai.ai));
      container.register(
        VIN_DECODERS_REGISTRATION,
        asValue([bmwTypeCodeDecoder]),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('Workshop quote draft', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;

      const upload = (body: Buffer, type = 'application/pdf') =>
        api
          .post('/admin/workshop-quotes/draft', body, {
            headers: { ...adminHeaders.headers, 'content-type': type },
          })
          .catch((error) => error.response);

      const catalogueRows = async () => ({
        brands: (await catalog.listBrands()).length,
        parts: (await catalog.listParts()).length,
        identifiers: (await catalog.listPartIdentifiers()).length,
        fitments: (await catalog.listFitments()).length,
      });

      beforeAll(async () => {
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@workshop-quote-tests.local',
          'supersecret',
        );
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      beforeEach(() => {
        ai.quotesRead.length = 0;
      });

      it('reads a quote into a draft naming the Vehicle and creates nothing', async () => {
        const { vehicle } = await createVehicleFixture(catalog);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        ai.reading = {
          vin: OWNER_VIN,
          vehicle: 'BMW 320d F30',
          lines: [
            {
              name: 'Filter ulja',
              number: 'HU 816 x',
              quantity: 1,
              brand: 'MANN-FILTER',
              brand_confidence: 0.95,
              category_id: oilFilters.id,
            },
            {
              name: 'Pločice',
              number: '34116860016',
              quantity: 2,
              brand: 'BMW',
              brand_confidence: 0.4,
              category_id: 'not-a-category',
            },
            {
              name: 'Sitni materijal',
              number: 'X-1',
              quantity: 1,
              brand: null,
              brand_confidence: 0,
              category_id: null,
            },
          ],
        };
        const before = await catalogueRows();

        const response = await upload(QUOTE_PDF);

        expect(response.status).toBe(200);
        expect(ai.quotesRead[0].pdf.equals(QUOTE_PDF)).toBe(true);
        expect(ai.quotesRead[0].categories).toEqual(
          expect.arrayContaining([
            { id: oilFilters.id, name: 'Масляные фильтры' },
          ]),
        );
        expect(response.data.draft).toEqual({
          vin: OWNER_VIN,
          vehicle_text: 'BMW 320d F30',
          vehicle: expect.objectContaining({ id: vehicle.id }),
          lines: [
            {
              name: 'Filter ulja',
              number: 'HU 816 x',
              quantity: 1,
              brand: 'MANN-FILTER',
              brand_confidence: 0.95,
              brand_uncertain: false,
              category: { id: oilFilters.id, name: 'Масляные фильтры' },
            },
            {
              name: 'Pločice',
              number: '34116860016',
              quantity: 2,
              brand: 'BMW',
              brand_confidence: 0.4,
              brand_uncertain: true,
              category: null,
            },
            {
              name: 'Sitni materijal',
              number: 'X-1',
              quantity: 1,
              brand: null,
              brand_confidence: 0,
              brand_uncertain: true,
              category: null,
            },
          ],
        });
        expect(JSON.stringify(response.data)).not.toMatch(/price/i);
        expect(await catalogueRows()).toEqual(before);
      });

      it('says the VIN resolves to no Vehicle', async () => {
        ai.reading = { vin: UNKNOWN_VIN, vehicle: 'BMW X5', lines: [] };

        const response = await upload(QUOTE_PDF);

        expect(response.status).toBe(200);
        expect(response.data.draft).toMatchObject({
          vin: UNKNOWN_VIN,
          vehicle: null,
        });
      });

      it('keeps a quote without a readable VIN', async () => {
        ai.reading = { vin: 'nečitljivo', vehicle: null, lines: [] };

        const response = await upload(QUOTE_PDF);

        expect(response.status).toBe(200);
        expect(response.data.draft).toMatchObject({
          vin: 'nečitljivo',
          vehicle: null,
        });
      });

      it('refuses a file that is not a PDF', async () => {
        const wrongType = await upload(QUOTE_PDF, 'image/png');
        const notPdf = await upload(Buffer.from('ponuda'));

        expect([wrongType.status, wrongType.data.code]).toEqual([
          400,
          'INVALID_QUOTE',
        ]);
        expect([notPdf.status, notPdf.data.code]).toEqual([
          400,
          'INVALID_QUOTE',
        ]);
        expect(ai.quotesRead).toEqual([]);
      });
    });
  },
});
