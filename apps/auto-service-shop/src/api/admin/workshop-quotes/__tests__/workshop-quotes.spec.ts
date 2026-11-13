import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../../integration-tests/fakeShopAi';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import {
  type QuoteReadingLine,
  SHOP_AI_REGISTRATION,
} from '../../../../lib/ai';
import { bmwTypeCodeDecoder } from '../../../../lib/vin/bmw-type-code';
import { VIN_DECODERS_REGISTRATION } from '../../../../lib/vin/chain';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const OWNER_VIN = 'WBA35BG070N074158';
const UNKNOWN_VIN = 'WBA99ZZ070N000001';
const QUOTE_PDF = Buffer.from('%PDF-1.4\n% ponuda\n%%EOF\n');

const ai = createFakeShopAi();

const quoteLine = (
  fields: Partial<Extract<QuoteReadingLine, { name_ru: string }>> = {},
) => ({
  name: 'Filter ulja',
  name_ru: 'Масляный фильтр',
  number: 'HU 816 x',
  quantity: 1,
  brand: 'MANN-FILTER',
  brand_confidence: 0.95,
  category_id: null,
  catalogue_part: true,
  ...fields,
});

const draftLine = (fields: Record<string, unknown>) => ({
  readable: true,
  catalogue_part: true,
  original_name: 'Filter ulja',
  name: 'Масляный фильтр',
  printed_number: 'HU 816 x',
  number: 'HU 816 x',
  quantity: 1,
  category: null,
  part: null,
  candidates: [],
  ...fields,
});

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
        const mann = await catalog.createBrands({
          name: 'MANN-FILTER',
          slug: 'mann-filter',
        });
        await catalog.createBrands({ name: 'BMW', slug: 'bmw' });
        ai.reading = {
          vin: OWNER_VIN,
          vehicle: 'BMW 320d F30',
          lines: [
            quoteLine({
              brand: 'Mann Filter',
              brand_confidence: 0.95,
              category_id: oilFilters.id,
            }),
            quoteLine({
              name: 'Pločice',
              name_ru: 'Тормозные колодки',
              number: '34116860016',
              quantity: 2,
              brand: 'BMW',
              brand_confidence: 0.4,
              category_id: 'not-a-category',
            }),
            quoteLine({
              name: 'Sitni materijal',
              name_ru: 'Расходный материал',
              number: 'X-1',
              brand: null,
              brand_confidence: 0,
              category_id: null,
              catalogue_part: false,
            }),
            { unreadable: true, name: 'Kaiš', number: '' },
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
        expect(ai.quotesRead[0].brands.sort()).toEqual(
          [mann.name, 'BMW'].sort(),
        );
        expect(response.data.draft).toEqual({
          vin: OWNER_VIN,
          vehicle_text: 'BMW 320d F30',
          vehicle: expect.objectContaining({ id: vehicle.id }),
          generation: null,
          candidates: [],
          lines: [
            draftLine({
              brand: 'MANN-FILTER',
              brand_confidence: 0.95,
              brand_uncertain: false,
              category: { id: oilFilters.id, name: 'Масляные фильтры' },
            }),
            draftLine({
              original_name: 'Pločice',
              name: 'Тормозные колодки',
              printed_number: '34116860016',
              number: '34116860016',
              quantity: 2,
              brand: 'BMW',
              brand_confidence: 0.4,
              brand_uncertain: true,
            }),
            draftLine({
              catalogue_part: false,
              original_name: 'Sitni materijal',
              name: 'Расходный материал',
              printed_number: 'X-1',
              number: 'X-1',
              brand: null,
              brand_confidence: 0,
              brand_uncertain: true,
            }),
            draftLine({
              readable: false,
              original_name: 'Kaiš',
              name: 'Kaiš',
              printed_number: '',
              number: '',
              quantity: null,
              brand: null,
              brand_confidence: 0,
              brand_uncertain: true,
            }),
          ],
        });
        expect(JSON.stringify(response.data)).not.toMatch(/price/i);
        expect(await catalogueRows()).toEqual(before);
      });

      it('settles the brand through the catalogue and its spellings', async () => {
        const febi = await catalog.createBrands({ name: 'Febi', slug: 'febi' });
        await catalog.createBrands({ name: 'FILTRON', slug: 'filtron' });
        const mahle = await catalog.createBrands({
          name: 'MAHLE',
          slug: 'mahle',
        });
        await catalog.createBrands({ name: 'Knecht', slug: 'knecht' });
        await catalog.createBrandSpellings([
          { supplier_id: null, value: 'febi bilstein', brand_id: febi.id },
          { supplier_id: null, value: 'Knecht', brand_id: mahle.id },
        ]);
        ai.reading = {
          vin: null,
          vehicle: null,
          lines: [
            quoteLine({ number: '12281', brand: 'FEBI BILSTEIN' }),
            quoteLine({ number: 'AP 139/5', brand: 'Filtron' }),
            quoteLine({ number: '0 451 103 336', brand: 'Bosch' }),
            quoteLine({ number: 'OC 90', brand: 'Knecht' }),
          ],
        };

        const response = await upload(QUOTE_PDF);

        expect(
          response.data.draft.lines.map(
            ({ brand, brand_uncertain }: Record<string, unknown>) => ({
              brand,
              brand_uncertain,
            }),
          ),
        ).toEqual([
          { brand: 'Febi', brand_uncertain: false },
          { brand: 'FILTRON', brand_uncertain: false },
          { brand: 'Bosch', brand_uncertain: true },
          { brand: 'MAHLE', brand_uncertain: false },
        ]);
      });

      it('finds the Part by its number once the software code is stripped', async () => {
        const elring = await catalog.createBrands({
          name: 'Elring',
          slug: 'elring',
        });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Уплотнительное кольцо',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: elring.id,
              value: '567.640',
            },
          ],
        });
        ai.reading = {
          vin: null,
          vehicle: null,
          lines: [
            quoteLine({
              name: 'Zaptivni prsten',
              name_ru: 'Кольцо',
              number: 'EL567640',
              brand: null,
              brand_confidence: 0,
            }),
          ],
        };

        const response = await upload(QUOTE_PDF);

        expect(response.data.draft.lines).toEqual([
          draftLine({
            original_name: 'Zaptivni prsten',
            name: 'Уплотнительное кольцо',
            printed_number: 'EL567640',
            number: '567.640',
            brand: 'Elring',
            brand_confidence: 1,
            brand_uncertain: false,
            part: { id: partId, name: 'Уплотнительное кольцо' },
          }),
        ]);
      });

      it('offers every Part sharing the number and names a prefix brand', async () => {
        const [febi, meyle] = await Promise.all(
          ['Febi', 'Meyle'].map((name) =>
            catalog.createBrands({ name, slug: name.toLowerCase() }),
          ),
        );
        const parts = await Promise.all(
          [febi, meyle].map((brand) =>
            catalog.createPartWithIdentifiers({
              name: `Сайлентблок ${brand.name}`,
              identifiers: [
                {
                  type: 'manufacturer-number',
                  brand_id: brand.id,
                  value: '12281',
                },
              ],
            }),
          ),
        );
        ai.reading = {
          vin: null,
          vehicle: null,
          lines: [
            quoteLine({ number: 'FE12281', brand: 'Meyle' }),
            quoteLine({ number: 'DRM01587', brand: null, brand_confidence: 0 }),
          ],
        };

        const response = await upload(QUOTE_PDF);

        const [shared, drMotor] = response.data.draft.lines;
        expect(shared).toMatchObject({
          number: '12281',
          brand: 'Febi',
          brand_uncertain: true,
          part: null,
        });
        expect(
          shared.candidates.map(({ part_id }: { part_id: string }) => part_id),
        ).toEqual(expect.arrayContaining(parts));
        expect(shared.candidates).toHaveLength(2);
        expect(drMotor).toMatchObject({
          number: 'DRM01587',
          brand: 'Dr.Motor',
          brand_confidence: 0.9,
          brand_uncertain: false,
          candidates: [],
        });
      });

      it('offers the Vehicles of an ambiguous VIN and their generation', async () => {
        const { vehicle: first } = await createVehicleFixture(catalog);
        const { vehicle: second } = await createVehicleFixture(catalog, {
          engineCode: 'N47D20C',
          engineFamily: 'N47',
        });
        ai.reading = { vin: OWNER_VIN, vehicle: 'BMW 320d', lines: [] };

        const response = await upload(QUOTE_PDF);

        expect(response.data.draft).toMatchObject({
          vehicle: null,
          generation: expect.stringContaining('320d'),
        });
        expect(
          response.data.draft.candidates.map(({ id }: { id: string }) => id),
        ).toEqual(expect.arrayContaining([first.id, second.id]));
        expect(response.data.draft.candidates).toHaveLength(2);
      });

      it('says the VIN resolves to no Vehicle', async () => {
        ai.reading = { vin: UNKNOWN_VIN, vehicle: 'BMW X5', lines: [] };

        const response = await upload(QUOTE_PDF);

        expect(response.status).toBe(200);
        expect(response.data.draft).toMatchObject({
          vin: UNKNOWN_VIN,
          vehicle: null,
        });
        const vinLookups: VinLookupModuleService =
          getContainer().resolve(VIN_LOOKUP_MODULE);
        const [lookup] = await vinLookups.listVinLookups({ vin: UNKNOWN_VIN });
        const hits = await vinLookups.listVinLookupHits({
          vin_lookup_id: lookup.id,
        });
        expect(new Set(hits.map(({ source }) => source))).toEqual(
          new Set(['workshop-quote']),
        );
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

      it('creates Parts, Brand-numbers and manual Fitments on the picked Vehicle', async () => {
        const { vehicle } = await createVehicleFixture(catalog);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });

        const response = await confirm({
          vehicle_ids: [vehicle.id],
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
          vehicles: [{ id: vehicle.id }],
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
              name: 'Pločice BMW 34116860016',
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
              name: 'Filter ulja MANN-FILTER HU 816 x',
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
          vehicle_ids: [vehicle.id],
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
        const { vehicle } = await createVehicleFixture(catalog);

        const response = await confirm({
          vehicle_ids: [vehicle.id],
          lines: [line({}), line({ number: 'X-1', brand: null })],
        });

        expect(response.status).toBe(400);
        expect(await catalog.listBrands()).toEqual([]);
        expect(await catalog.listParts()).toEqual([]);
        expect(await catalog.listFitments()).toEqual([]);
      });

      it('rolls back every line when one line fails', async () => {
        const { vehicle } = await createVehicleFixture(catalog);

        const response = await confirm({
          vehicle_ids: [vehicle.id],
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

      it('fits a whole generation on its engine-less Vehicle', async () => {
        const { vehicle: first, model } = await createVehicleFixture(catalog);
        const { vehicle: second } = await createVehicleFixture(catalog, {
          engineCode: 'N47D20C',
          engineFamily: 'N47',
          powerKw: 135,
          years: [2012, 2016],
        });

        const response = await confirm({
          vehicle_ids: [first.id, second.id],
          generation: true,
          lines: [line({})],
        });

        expect(response.status).toBe(200);
        const [generation] = await catalog.listVehicles({
          model_id: model.id,
          engine_id: null,
        });
        expect(generation).toMatchObject({
          power_kw: null,
          year_from: 2012,
          year_to: 2019,
          source: 'workshop-quote',
        });
        expect(response.data.confirmed).toMatchObject({
          vehicles: [{ id: generation!.id, engine: null }],
          fitments: 1,
        });
        expect(
          (await catalog.listFitments()).map(({ vehicle_id }) => vehicle_id),
        ).toEqual([generation!.id]);
      });

      it('fits a whole generation on the engine-less Vehicle it already has', async () => {
        const { vehicle, model } = await createVehicleFixture(catalog);
        const known = await catalog.createVehicles({
          model_id: model.id,
          engine_id: null,
          power_kw: null,
          year_from: 2014,
          year_to: 2018,
        });

        const response = await confirm({
          vehicle_ids: [vehicle.id],
          generation: true,
          lines: [line({})],
        });

        expect(response.status).toBe(200);
        expect(
          await catalog.listVehicles({ model_id: model.id, engine_id: null }),
        ).toHaveLength(1);
        expect(
          (await catalog.listFitments()).map(({ vehicle_id }) => vehicle_id),
        ).toEqual([known.id]);
      });

      it('fits every Vehicle staff picked', async () => {
        const { vehicle: first } = await createVehicleFixture(catalog);
        const { vehicle: second } = await createVehicleFixture(catalog, {
          engineCode: 'N47D20C',
          engineFamily: 'N47',
        });

        const response = await confirm({
          vehicle_ids: [first.id, second.id],
          lines: [line({})],
        });

        expect(response.status).toBe(200);
        expect(response.data.confirmed.fitments).toBe(2);
        expect(
          (await catalog.listFitments()).map(({ vehicle_id }) => vehicle_id),
        ).toEqual(expect.arrayContaining([first.id, second.id]));
      });

      it('creates Parts without Fitments when staff chose no fitment', async () => {
        await createVehicleFixture(catalog);

        const response = await confirm({ vehicle_ids: [], lines: [line({})] });

        expect(response.status).toBe(200);
        expect(response.data.confirmed).toMatchObject({
          vehicles: [],
          fitments: 0,
          lines: [{ reused: false }],
        });
        expect(await catalog.listParts()).toHaveLength(1);
        expect(await catalog.listPartIdentifiers()).toHaveLength(1);
        expect(await catalog.listFitments()).toEqual([]);
      });

      it('keeps a name that already carries the number', async () => {
        const response = await confirm({
          vehicle_ids: [],
          lines: [line({ name: 'Масляный фильтр MANN HU816X' })],
        });

        expect(response.status).toBe(200);
        expect(await catalog.listParts()).toMatchObject([
          { name: 'Масляный фильтр MANN HU816X' },
        ]);
      });

      it('refuses an unknown Vehicle and creates nothing', async () => {
        const response = await confirm({
          vehicle_ids: ['veh_missing'],
          lines: [line({})],
        });

        expect(response.status).toBe(404);
        expect(await catalog.listParts()).toEqual([]);
      });

      it('wants the fitment choice stated', async () => {
        const response = await confirm({ lines: [line({})] });

        expect(response.status).toBe(400);
        expect(await catalog.listParts()).toEqual([]);
      });

      it('takes no price from the quote', async () => {
        const response = await confirm({
          vehicle_ids: [],
          lines: [line({ price: 4200 })],
        });

        expect(response.status).toBe(400);
        expect(await catalog.listParts()).toEqual([]);
      });
    });
  },
});
