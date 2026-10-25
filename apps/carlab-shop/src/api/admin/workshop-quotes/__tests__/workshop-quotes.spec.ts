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

    describe('Workshop quote confirmation', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;

      const confirm = (body: unknown) =>
        api
          .post('/admin/workshop-quotes', body, adminHeaders)
          .catch((error) => error.response);

      const line = (fields: Record<string, unknown>) => ({
        name: 'Filter ulja',
        number: 'HU 816 x',
        quantity: 1,
        brand: 'MANN-FILTER',
        category_id: null,
        ...fields,
      });

      beforeAll(async () => {
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@workshop-quote-confirm.local',
          'supersecret',
        );
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      it('creates Parts, Brand-numbers and manual Fitments on the VIN Vehicle', async () => {
        const { vehicle } = await createVehicleFixture(catalog);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });

        const response = await confirm({
          vin: OWNER_VIN,
          lines: [
            line({ category_id: oilFilters.id }),
            line({
              name: 'Pločice',
              number: '34116860016',
              quantity: 2,
              brand: 'bmw',
            }),
          ],
        });

        expect(response.status).toBe(200);
        expect(response.data.confirmed).toMatchObject({
          vehicle: { id: vehicle.id },
          fitments: 2,
        });
        const mann = await catalog.listBrands({ name: 'MANN-FILTER' });
        expect(mann).toMatchObject([{ slug: 'mann-filter' }]);
        const identifiers = await catalog.listPartIdentifiers(
          {},
          { relations: ['part', 'part.fitments'] },
        );
        expect(
          identifiers
            .map((identifier) => ({
              brand_id: identifier.brand_id,
              value: identifier.value,
              part: {
                name: identifier.part.name,
                category_id: identifier.part.category_id,
                source: identifier.part.source,
              },
              fitments: identifier.part.fitments.map((fitment) => ({
                vehicle_id: fitment.vehicle_id,
                quantity: fitment.quantity,
                source: fitment.source,
              })),
            }))
            .sort((a, b) => a.value.localeCompare(b.value)),
        ).toEqual([
          {
            brand_id: bmw.id,
            value: '34116860016',
            part: {
              name: 'Pločice',
              category_id: null,
              source: 'workshop-quote',
            },
            fitments: [
              { vehicle_id: vehicle.id, quantity: 2, source: 'manual' },
            ],
          },
          {
            brand_id: mann[0].id,
            value: 'HU 816 x',
            part: {
              name: 'Filter ulja',
              category_id: oilFilters.id,
              source: 'workshop-quote',
            },
            fitments: [
              { vehicle_id: vehicle.id, quantity: 1, source: 'manual' },
            ],
          },
        ]);
      });

      it('reuses an existing Brand-number and only adds the Fitment', async () => {
        const { vehicle } = await createVehicleFixture(catalog);
        const mann = await catalog.createBrands({
          name: 'MANN-FILTER',
          slug: 'mann-filter',
        });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU816X',
            },
          ],
        });

        const response = await confirm({
          vin: OWNER_VIN,
          lines: [line({ brand: 'Mann-Filter', quantity: 3 })],
        });

        expect(response.status).toBe(200);
        expect(response.data.confirmed).toMatchObject({
          lines: [{ part_id: partId, reused: true }],
          fitments: 1,
        });
        expect(await catalog.listBrands()).toHaveLength(1);
        expect(await catalog.listParts()).toMatchObject([
          { id: partId, name: 'Масляный фильтр', source: 'manual' },
        ]);
        expect(await catalog.listPartIdentifiers()).toHaveLength(1);
        expect(await catalog.listFitments()).toMatchObject([
          { part_id: partId, vehicle_id: vehicle.id, quantity: 3 },
        ]);
      });

      it('refuses a line without a confirmed brand and creates nothing', async () => {
        await createVehicleFixture(catalog);

        const response = await confirm({
          vin: OWNER_VIN,
          lines: [line({}), line({ number: 'X-1', brand: null })],
        });

        expect(response.status).toBe(400);
        expect(await catalog.listBrands()).toEqual([]);
        expect(await catalog.listParts()).toEqual([]);
        expect(await catalog.listFitments()).toEqual([]);
      });

      it('rolls back every line when one line fails', async () => {
        await createVehicleFixture(catalog);

        const response = await confirm({
          vin: OWNER_VIN,
          lines: [line({}), line({ number: 'X-1', brand: 'Бош' })],
        });

        expect([response.status, response.data.code]).toEqual([
          400,
          'INVALID_BRAND',
        ]);
        expect(await catalog.listBrands()).toEqual([]);
        expect(await catalog.listParts()).toEqual([]);
        expect(await catalog.listFitments()).toEqual([]);
      });

      it('creates Parts without Fitments when the VIN resolves to no Vehicle', async () => {
        await createVehicleFixture(catalog);

        const response = await confirm({
          vin: UNKNOWN_VIN,
          lines: [line({})],
        });

        expect(response.status).toBe(200);
        expect(response.data.confirmed).toMatchObject({
          vehicle: null,
          fitments: 0,
          lines: [{ reused: false }],
        });
        expect(await catalog.listParts()).toHaveLength(1);
        expect(await catalog.listPartIdentifiers()).toHaveLength(1);
        expect(await catalog.listFitments()).toEqual([]);
      });

      it('takes no price from the quote', async () => {
        const response = await confirm({
          vin: null,
          lines: [line({ price: 4200 })],
        });

        expect(response.status).toBe(400);
        expect(await catalog.listParts()).toEqual([]);
      });
    });
  },
});
