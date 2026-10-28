import { createServer, type Server } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';

import { asValue } from '@medusajs/framework/awilix';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../../integration-tests/fakeShopAi';
import { memoryStorage } from '../../../../../integration-tests/fakeStorage';
import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { SHOP_AI_REGISTRATION } from '../../../../lib/ai';
import { publishAllNumbers } from '../../../../lib/publish/published';
import { SHOP_STORAGE_REGISTRATION } from '../../../../lib/storage';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../../../../lib/suppliers/adapter';
import {
  IMAGE_LOOKUP_REGISTRATION,
  publicLookup,
} from '../../../../lib/suppliers/mirrored-images';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const intercars = createFakeSupplier('Intercars');
const warehouse = createFakeSupplier('Warehouse');
const shopAi = createFakeShopAi();
const storage = memoryStorage();
const BRAND_IMAGES_HOST = 'images.brand.test';
const imageLookup: LookupFunction = (hostname, options, callback) =>
  hostname === BRAND_IMAGES_HOST
    ? options.all
      ? callback(null, [{ address: '127.0.0.1', family: 4 }])
      : callback(null, '127.0.0.1', 4)
    : publicLookup(hostname, options, callback);

type Page = {
  normalized_value: string;
  part: {
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    attributes: Record<string, unknown>;
  };
  offers: unknown[];
  equivalents: unknown[];
  supplier_data: Record<string, unknown[]>;
};

medusaIntegrationTestRunner({
  moduleName: 'supplier-imports',
  dbName: 'medusa-supplier-imports-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([intercars.adapter, warehouse.adapter]),
      );
      container.register(SHOP_AI_REGISTRATION, asValue(shopAi.ai));
      container.register(SHOP_STORAGE_REGISTRATION, asValue(storage.storage));
      container.register(IMAGE_LOOKUP_REGISTRATION, asValue(imageLookup));
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('supplier import', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let intercarsId: string;
      let oilFiltersId: string;
      let engineOilId: string;

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@supplier-imports.local',
          'supersecret',
        );
        const key = await apiKeys.createApiKeys({
          title: 'supplier-imports',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [ic, wh] = await suppliers.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
          { name: 'Warehouse', markup_percentage: 10 },
        ]);
        intercarsId = ic.id;
        const [mann] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Bosch', slug: 'bosch' },
        ]);
        await catalog.createBrandSpellings([
          { brand_id: mann.id, supplier_id: ic.id, value: 'MANN-FILTER' },
          { brand_id: mann.id, supplier_id: wh.id, value: 'Mann' },
        ]);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        oilFiltersId = oilFilters.id;
        const strict = await catalog.createCategories({
          slug: 'engine-oil',
          name: 'Моторное масло',
        });
        engineOilId = strict.id;
        await catalog.createCategoryFields({
          category_id: strict.id,
          key: 'viscosity',
          type: 'text',
          label: 'Вязкость',
          required: true,
        });
        await suppliers.createSupplierCategories([
          { supplier_id: ic.id, code: 'IC-OIL', category_id: oilFilters.id },
          { supplier_id: ic.id, code: 'IC-ENGINE-OIL', category_id: strict.id },
          { supplier_id: wh.id, code: 'filters', category_id: oilFilters.id },
        ]);
        await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });
      });

      beforeEach(() => {
        for (const fake of [intercars, warehouse]) {
          fake.articles.length = 0;
          fake.unreadable.length = 0;
          fake.notInScope = 0;
          fake.quotes.clear();
        }
        Object.assign(shopAi, {
          category: null,
          attributes: {},
          description: '',
          categoryPicks: [],
          specsMapped: [],
          descriptionsWritten: [],
          failure: null,
        });
      });

      const runImport = () =>
        api
          .post('/admin/supplier-imports', {}, adminHeaders)
          .catch((error) => error.response);

      const pages = async (): Promise<Page[]> =>
        (await api.get('/store/part-pages', storeHeaders)).data.pages;

      const page = async (normalized: string) =>
        (await pages()).find((entry) => entry.normalized_value === normalized);

      const offerHu816x = (
        fake: typeof intercars,
        article: { article_id: string; brand: string; category: string },
        quote: {
          cost_price: number;
          quantity: number;
          lead_time_days: number;
        },
      ) => {
        fake.articles.push({
          ...article,
          number: 'HU-816 X',
          name: 'Фильтр масляный',
        });
        fake.quotes.set(article.article_id, {
          article_id: article.article_id,
          cost_price: quote.cost_price,
          currency: 'RSD',
          stock: [{ location: 'Beograd', quantity: quote.quantity }],
          lead_time_days: quote.lead_time_days,
        });
      };

      it('attaches an offer to the existing PartIdentifier for a Brand alias and a spaced number', async () => {
        intercars.articles.push({
          article_id: 'IC-1',
          brand: 'MANN-FILTER',
          number: 'HU-816 X',
          name: 'Фильтр масляный MANN',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-1', {
          article_id: 'IC-1',
          cost_price: 1000,
          currency: 'RSD',
          stock: [
            { location: 'Beograd', quantity: 3 },
            { location: 'Novi Sad', quantity: 2 },
          ],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.status).toBe(200);
        const all = await pages();
        expect(all).toHaveLength(1);
        expect(all[0].part.name).toBe('Oil filter');
        expect(all[0].offers).toEqual([
          {
            id: expect.any(String),
            price: 1200,
            currency: 'RSD',
            stock_quantity: 5,
            lead_time_days: 1,
          },
        ]);
      });

      it('stores no offer for an article quoted in another currency', async () => {
        intercars.articles.push({
          article_id: 'IC-EUR',
          brand: 'MANN-FILTER',
          number: 'HU-816 X',
          name: 'Фильтр масляный MANN',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-EUR', {
          article_id: 'IC-EUR',
          cost_price: 9,
          currency: 'EUR',
          stock: [{ location: 'Beograd', quantity: 3 }],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.status).toBe(200);
        expect((await page('HU816X'))?.offers).toEqual([]);
      });

      it('creates a new Part in the mapped Category, stamped with its source, for an unknown number', async () => {
        intercars.articles.push({
          article_id: 'IC-2',
          brand: 'MANN-FILTER',
          number: 'W 712/95',
          name: 'Фильтр масляный W 712/95',
          category: 'IC-OIL',
        });

        await runImport();

        const created = await page('W71295');
        expect(created).toMatchObject({
          part: { name: 'Фильтр масляный W 712/95', category_id: oilFiltersId },
          offers: [],
        });
        const [part] = await catalog.listParts({ id: created!.part.id });
        expect(part.source).toBe('Intercars');
      });

      it('keeps a Part it creates out of search until a publish deploys its page', async () => {
        intercars.articles.push({
          article_id: 'IC-15',
          brand: 'MANN-FILTER',
          number: 'HU 7020 z',
          name: 'Фильтр HU7020',
          category: 'IC-OIL',
        });
        const found = async () =>
          (await api.get('/store/search?q=HU7020z&locale=ru', storeHeaders))
            .data.count;

        await runImport();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const beforePublish = await found();
        await publishAllNumbers(getContainer());
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });

        expect(beforePublish).toBe(0);
        expect(await found()).toBe(1);
      });

      it('creates the Part without a Category whose required fields the article cannot fill and names it in the summary', async () => {
        intercars.articles.push({
          article_id: 'IC-3',
          brand: 'MANN-FILTER',
          number: 'OIL 5W30',
          name: 'Масло моторное 5W-30',
          category: 'IC-ENGINE-OIL',
        });

        const response = await runImport();

        expect((await page('OIL5W30'))?.part.category_id).toBeNull();
        expect(response.data.imports[0]).toMatchObject({
          supplier: 'Intercars',
          needs_category: ['OIL 5W30'],
        });
      });

      it('skips an article of an unlisted Brand and leaves an article AI cannot classify without a Category', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-4',
            brand: 'MANN-FILTER',
            number: 'C 30 005',
            name: 'Фильтр воздушный',
            category: 'IC-TYRES',
          },
          {
            article_id: 'IC-5',
            brand: 'BOSCH',
            number: 'F 026 407 157',
            name: 'Фильтр масляный BOSCH',
            category: 'IC-OIL',
          },
        );

        const response = await runImport();

        expect(response.data.imports).toEqual([
          {
            supplier: 'Intercars',
            imported: 0,
            created: 1,
            skipped: 1,
            skipped_by_reason: {
              brand: 1,
              currency: 0,
              unreadable: 0,
              no_engine_code: 0,
              not_in_scope: 0,
            },
            needs_category: ['C 30 005'],
          },
          {
            supplier: 'Warehouse',
            imported: 0,
            created: 0,
            skipped: 0,
            skipped_by_reason: {
              brand: 0,
              currency: 0,
              unreadable: 0,
              no_engine_code: 0,
              not_in_scope: 0,
            },
            needs_category: [],
          },
        ]);
        expect((await page('C30005'))?.part.category_id).toBeNull();
        expect(await page('F026407157')).toBeUndefined();
      });

      it('imports the rest of the catalogue past a page the Supplier could not read, and counts it and the pages out of scope as skipped', async () => {
        intercars.unreadable.push({
          url: 'https://intercars.test/p/broken',
          reason: 'Unexpected markup',
        });
        intercars.notInScope = 2;
        intercars.articles.push({
          article_id: 'IC-30',
          brand: 'MANN-FILTER',
          number: 'W 610/3',
          name: 'Фильтр W610',
          category: 'IC-OIL',
        });

        const response = await runImport();

        expect(response.data.imports[0]).toEqual({
          supplier: 'Intercars',
          imported: 0,
          created: 1,
          skipped: 3,
          skipped_by_reason: {
            brand: 0,
            currency: 0,
            unreadable: 1,
            no_engine_code: 0,
            not_in_scope: 2,
          },
          needs_category: [],
        });
        expect(await page('W6103')).toBeDefined();
      });

      it('names a Part after the first of its Supplier pages in catalogue order, the same on every import', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-31',
            brand: 'MANN-FILTER',
            number: 'W 811/80',
            name: 'Фильтр W811 первый',
            category: 'IC-OIL',
          },
          {
            article_id: 'IC-32',
            brand: 'MANN-FILTER',
            number: 'W 811/80',
            name: 'Фильтр W811 второй',
            category: 'IC-OIL',
          },
        );

        await runImport();
        expect((await page('W81180'))?.part.name).toBe('Фильтр W811 первый');

        await runImport();
        expect((await page('W81180'))?.part.name).toBe('Фильтр W811 первый');
      });

      it('fills a Part from a Supplier that quotes nothing with an AI Category, attributes and a description, and no Offer', async () => {
        intercars.articles.push({
          article_id: 'IC-20',
          brand: 'MANN-FILTER',
          number: 'OIL 0W20',
          name: 'Масло 0W-20',
          category: 'Motorna ulja',
          description: 'Potpuno sintetičko motorno ulje 0W-20.',
          specs: { Viskozitet: '0W-20', Zapremina: '5 l' },
          applicability: ['BMW G20 320i'],
        });
        shopAi.category = engineOilId;
        shopAi.attributes = { viscosity: '0W-20' };
        shopAi.description = 'Синтетическое моторное масло 0W-20.';

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          needs_category: [],
        });
        expect(await page('OIL0W20')).toMatchObject({
          part: {
            category_id: engineOilId,
            attributes: { viscosity: '0W-20' },
            description: 'Синтетическое моторное масло 0W-20.',
          },
          offers: [],
          supplier_data: { applicability: [] },
        });
        const facts = {
          name: 'Масло 0W-20',
          brand: 'MANN-FILTER',
          number: 'OIL 0W20',
          description: 'Potpuno sintetičko motorno ulje 0W-20.',
          specs: { Viskozitet: '0W-20', Zapremina: '5 l' },
        };
        expect(shopAi.categoryPicks).toEqual([
          {
            article: facts,
            categories: expect.arrayContaining([
              { id: engineOilId, name: 'Моторное масло', text: '' },
              { id: oilFiltersId, name: 'Масляные фильтры', text: '' },
            ]),
          },
        ]);
        expect(shopAi.specsMapped).toEqual([
          {
            specs: facts.specs,
            fields: [
              {
                key: 'viscosity',
                label: 'Вязкость',
                type: 'text',
                unit: null,
                required: true,
                options: [],
              },
            ],
          },
        ]);
        expect(shopAi.descriptionsWritten).toEqual([
          { article: facts, name: 'Масло 0W-20', category: 'Моторное масло' },
        ]);
      });

      it('keeps the mapped Category over AI and asks for no attributes a Category without fields cannot hold', async () => {
        intercars.articles.push({
          article_id: 'IC-21',
          brand: 'MANN-FILTER',
          number: 'W 940',
          name: 'Фильтр W940',
          category: 'IC-OIL',
          specs: { Visina: '120 mm' },
        });
        shopAi.category = engineOilId;
        shopAi.attributes = { height: 120 };

        await runImport();

        expect((await page('W940'))?.part).toMatchObject({
          category_id: oilFiltersId,
          attributes: {},
        });
        expect(shopAi.specsMapped).toEqual([]);
        expect(shopAi.categoryPicks).toEqual([]);
      });

      it('still creates the Part, unclassified and undescribed, when AI fails', async () => {
        intercars.articles.push({
          article_id: 'IC-24',
          brand: 'MANN-FILTER',
          number: 'W 970',
          name: 'Фильтр W970',
          category: 'Filteri',
          description: 'Filter ulja W 970.',
        });
        shopAi.failure = new Error('OpenAI is down');

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          needs_category: ['W 970'],
        });
        expect((await page('W970'))?.part).toMatchObject({
          category_id: null,
          description: null,
        });
      });

      it('files a Part it left without a Category once a later import classifies it', async () => {
        intercars.articles.push({
          article_id: 'IC-26',
          brand: 'MANN-FILTER',
          number: 'W 990',
          name: 'Фильтр W990',
          category: 'Filteri',
          specs: { Visina: '80 mm' },
        });
        shopAi.failure = new Error('OpenAI is down');
        await runImport();
        shopAi.failure = null;
        shopAi.category = oilFiltersId;

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({ needs_category: [] });
        expect((await page('W990'))?.part.category_id).toBe(oilFiltersId);
      });

      it('names a Part a later import still cannot file in the summary', async () => {
        intercars.articles.push({
          article_id: 'IC-27',
          brand: 'MANN-FILTER',
          number: 'OIL 0W20',
          name: 'Масло моторное 0W-20',
          category: 'Filteri',
        });
        shopAi.failure = new Error('OpenAI is down');
        await runImport();
        shopAi.failure = null;
        shopAi.category = engineOilId;

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          needs_category: ['OIL 0W20'],
        });
        expect((await page('OIL0W20'))?.part.category_id).toBeNull();
      });

      it('writes an imported description once and never over a hand edit', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-22',
            brand: 'MANN-FILTER',
            number: 'W 950',
            name: 'Фильтр W950',
            category: 'IC-OIL',
            description: 'Filter ulja W 950.',
          },
          {
            article_id: 'IC-23',
            brand: 'MANN-FILTER',
            number: 'W 960',
            name: 'Фильтр W960',
            category: 'IC-OIL',
            description: 'Filter ulja W 960.',
          },
        );
        shopAi.description = 'Масляный фильтр.';
        await runImport();
        const edited = (await page('W950'))!.part;
        await api.post(
          `/admin/parts/${edited.id}`,
          { description: 'Описание от мастера.' },
          adminHeaders,
        );
        intercars.articles[0].description = 'Novi opis W 950.';
        intercars.articles[1].description = 'Novi opis W 960.';
        shopAi.description = 'Новое описание.';

        await runImport();

        expect((await page('W950'))?.part.description).toBe(
          'Описание от мастера.',
        );
        expect((await page('W960'))?.part.description).toBe('Масляный фильтр.');
        expect(shopAi.descriptionsWritten).toHaveLength(2);
      });

      it('still describes and renames a Part whose Category staff changed', async () => {
        intercars.articles.push({
          article_id: 'IC-25',
          brand: 'MANN-FILTER',
          number: 'W 980',
          name: 'Фильтр W980',
          category: 'IC-OIL',
          description: 'Filter ulja W 980.',
        });
        shopAi.failure = new Error('OpenAI is down');
        await runImport();
        const recategorized = (await page('W980'))!.part;
        const update = await api.post(
          `/admin/parts/${recategorized.id}`,
          { category_id: null },
          adminHeaders,
        );
        expect(update.status).toBe(200);
        shopAi.failure = null;
        shopAi.description = 'Масляный фильтр W 980.';
        intercars.articles[0].name = 'Фильтр W980 новый';

        await runImport();

        expect((await page('W980'))?.part).toMatchObject({
          name: 'Фильтр W980 новый',
          description: 'Масляный фильтр W 980.',
          category_id: null,
        });
        expect(shopAi.descriptionsWritten).toContainEqual(
          expect.objectContaining({
            name: 'Фильтр W980 новый',
            category: null,
          }),
        );
      });

      it('matches a Brand spelling whatever its case and spacing', async () => {
        intercars.articles.push({
          article_id: 'IC-8',
          brand: ' mann-filter ',
          number: 'W 610/3',
          name: 'Фильтр W610',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-8', {
          article_id: 'IC-8',
          cost_price: 900,
          currency: 'EUR',
          stock: [{ location: 'Beograd', quantity: 1 }],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          skipped: 0,
          skipped_by_reason: { currency: 1 },
        });
        expect(await page('W6103')).toBeDefined();
      });

      it('matches a Brand spelling written with a no-break space and a sharp s', async () => {
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const [strasse] = await catalog.createBrands([
          { name: 'Strasse Teile', slug: 'strasse-teile' },
        ]);
        await catalog.createBrandSpellings({
          brand_id: strasse.id,
          supplier_id: intercarsId,
          value: 'Straße\u00a0Teile',
        });
        await suppliers.createSupplierCategories({
          supplier_id: intercarsId,
          code: 'IC\u00a0Öl',
          category_id: oilFiltersId,
        });
        intercars.articles.push({
          article_id: 'IC-16',
          brand: 'STRASSE TEILE',
          number: 'ST 1',
          name: 'Фильтр ST1',
          category: 'ic öl',
        });

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          skipped: 0,
        });
      });

      it('matches a supplier category code whatever its case and spacing', async () => {
        intercars.articles.push({
          article_id: 'IC-9',
          brand: 'MANN-FILTER',
          number: 'W 712/95',
          name: 'Фильтр W712',
          category: ' ic-oil ',
        });

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          skipped: 0,
        });
        expect((await page('W71295'))?.part.category_id).toBe(oilFiltersId);
      });

      it('keeps a name a person edited and refreshes one nobody touched', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-6',
            brand: 'MANN-FILTER',
            number: 'W 712/95',
            name: 'Фильтр W712',
            category: 'IC-OIL',
          },
          {
            article_id: 'IC-7',
            brand: 'MANN-FILTER',
            number: 'W 719/30',
            name: 'Фильтр W719',
            category: 'IC-OIL',
          },
        );
        await runImport();
        const edited = await page('W71295');
        const update = await api.post(
          `/admin/parts/${edited!.part.id}`,
          { name: 'Масляный фильтр MANN W 712/95' },
          adminHeaders,
        );
        expect(update.status).toBe(200);
        intercars.articles[0].name = 'Фильтр W712 новый';
        intercars.articles[1].name = 'Фильтр W719 новый';

        await runImport();

        expect((await page('W71295'))?.part.name).toBe(
          'Масляный фильтр MANN W 712/95',
        );
        expect((await page('W71930'))?.part.name).toBe('Фильтр W719 новый');
      });

      it('holds TecDoc-derived data in staging until its kind is released', async () => {
        intercars.articles.push({
          article_id: 'IC-8',
          brand: 'MANN-FILTER',
          number: 'HU 816 x',
          name: 'Фильтр масляный',
          category: 'IC-OIL',
          cross_references: [{ brand: 'BMW', number: '11 42 7512 300' }],
          applicability: ['BMW E46 320d 2001-2005'],
          images: ['https://cdn.intercars.test/hu816x.jpg'],
        });
        await runImport();

        expect(await page('HU816X')).toMatchObject({
          equivalents: [],
          supplier_data: {
            cross_references: [],
            applicability: [],
            images: [],
          },
        });

        const released = await api.post(
          `/admin/suppliers/${intercarsId}`,
          { released_kinds: ['applicability'] },
          adminHeaders,
        );
        expect(released.status).toBe(200);

        expect((await page('HU816X'))?.supplier_data).toEqual({
          cross_references: [],
          applicability: ['BMW E46 320d 2001-2005'],
          images: [],
        });
      });

      describe('crawled images', () => {
        let server: Server;
        let port: number;
        const served: string[] = [];

        beforeAll(async () => {
          server = createServer((request, response) => {
            served.push(request.url!);
            if (request.url === '/hu7020z.jpg') {
              response.writeHead(200, { 'content-type': 'image/jpeg' });
              response.end(Buffer.from('jpeg-bytes'));
            } else if (request.url === '/huge.jpg') {
              response.writeHead(200, { 'content-type': 'image/jpeg' });
              response.end(Buffer.alloc(10 * 1024 * 1024 + 1));
            } else {
              response.writeHead(404).end();
            }
          });
          await new Promise<void>((resolve) => server.listen(0, resolve));
          port = (server.address() as AddressInfo).port;
        });

        afterAll(() => new Promise((resolve) => server.close(resolve)));

        beforeEach(async () => {
          served.length = 0;
          await api.post(
            `/admin/suppliers/${intercarsId}`,
            { released_kinds: ['images'] },
            adminHeaders,
          );
        });

        const brandImage = (path: string) =>
          `http://${BRAND_IMAGES_HOST}:${port}${path}`;

        const articleWithImages = (images: string[]) => ({
          article_id: 'IC-IMG',
          brand: 'MANN-FILTER',
          number: 'HU 7020 z',
          name: 'Фильтр масляный HU 7020 z',
          category: 'IC-OIL',
          images,
        });

        const stagedImages = async () => {
          const suppliers: SupplierModuleService =
            getContainer().resolve(SUPPLIER_MODULE);
          return (
            await suppliers.listStagedRecords({
              supplier_id: intercarsId,
              kind: 'images',
            })
          ).map(({ payload }) => payload);
        };

        it('copies a crawled image to the public bucket once, keeps its source URL and serves the copy', async () => {
          const source = brandImage('/hu7020z.jpg');
          intercars.articles.push(articleWithImages([source]));

          await runImport();
          await runImport();

          expect(served).toEqual(['/hu7020z.jpg']);
          const [[key, stored]] = [...storage.images.objects].filter(
            ([, object]) => object.metadata['source-url'] === source,
          );
          const copy = `https://files.carlab.test/${key}`;
          expect(stored.body.toString()).toBe('jpeg-bytes');
          expect(stored.contentType).toBe('image/jpeg');
          expect((await page('HU7020Z'))?.supplier_data.images).toEqual([copy]);
          expect(await stagedImages()).toEqual([
            { items: [copy], sources: { [copy]: source } },
          ]);
        });

        it('stages nothing for an image it cannot fetch, and tries again on the next import', async () => {
          const source = brandImage('/missing.jpg');
          intercars.articles.push(articleWithImages([source]));

          await runImport();
          await runImport();

          expect(served).toEqual(['/missing.jpg', '/missing.jpg']);
          expect((await page('HU7020Z'))?.supplier_data.images).toEqual([]);
        });

        it('stops reading an image past the size cap and stages nothing for it', async () => {
          intercars.articles.push(articleWithImages([brandImage('/huge.jpg')]));

          await runImport();

          expect(served).toEqual(['/huge.jpg']);
          expect((await page('HU7020Z'))?.supplier_data.images).toEqual([]);
        });

        it('never fetches an image from a private address or over another scheme', async () => {
          intercars.articles.push(
            articleWithImages([
              `http://127.0.0.1:${port}/hu7020z.jpg`,
              `http://localhost:${port}/hu7020z.jpg`,
              'file:///etc/passwd',
            ]),
          );

          await runImport();

          expect(served).toEqual([]);
          expect((await page('HU7020Z'))?.supplier_data.images).toEqual([]);
        });
      });

      it('returns offers best first without supplier names', async () => {
        offerHu816x(
          intercars,
          { article_id: 'IC-9', brand: 'MANN-FILTER', category: 'IC-OIL' },
          { cost_price: 1000, quantity: 0, lead_time_days: 3 },
        );
        offerHu816x(
          warehouse,
          { article_id: 'WH-1', brand: 'Mann', category: 'filters' },
          { cost_price: 1100, quantity: 2, lead_time_days: 0 },
        );

        await runImport();

        const offered = await page('HU816X');
        const expected = [
          {
            id: expect.any(String),
            price: 1210,
            currency: 'RSD',
            stock_quantity: 2,
            lead_time_days: 0,
          },
          {
            id: expect.any(String),
            price: 1200,
            currency: 'RSD',
            stock_quantity: 0,
            lead_time_days: 3,
          },
        ];
        expect(offered?.offers).toEqual(expected);
        const part = (
          await api.get(`/store/parts/${offered!.part.id}`, storeHeaders)
        ).data.part;
        expect(part.identifiers[0].offers).toEqual(expected);
        expect(JSON.stringify([offered, part])).not.toMatch(
          /Intercars|Warehouse|IC-9|WH-1/,
        );
      });

      it('drops the offer of an article the supplier no longer lists and keeps the page', async () => {
        offerHu816x(
          intercars,
          { article_id: 'IC-10', brand: 'MANN-FILTER', category: 'IC-OIL' },
          { cost_price: 1000, quantity: 1, lead_time_days: 0 },
        );
        await runImport();
        intercars.articles.length = 0;

        await runImport();

        expect((await page('HU816X'))?.offers).toEqual([]);
      });

      it('deletes what an import created by its source, refusing while manual rows hang off it', async () => {
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const sources = async () =>
          Object.fromEntries(
            (
              await api.get('/admin/catalogue-sources', adminHeaders)
            ).data.sources.map(
              ({ source, rows }: { source: string; rows: number }) => [
                source,
                rows,
              ],
            ),
          );
        const removeSource = () =>
          api
            .delete('/admin/catalogue-sources/Intercars', adminHeaders)
            .catch((error) => error.response);
        offerHu816x(
          intercars,
          { article_id: 'IC-11', brand: 'MANN-FILTER', category: 'IC-OIL' },
          { cost_price: 1000, quantity: 1, lead_time_days: 0 },
        );
        intercars.articles.push({
          article_id: 'IC-12',
          brand: 'MANN-FILTER',
          number: 'C 30 005',
          name: 'Фильтр воздушный',
          category: 'IC-OIL',
          cross_references: [{ brand: 'BMW', number: '13 71 8 577 170' }],
        });
        intercars.quotes.set('IC-12', {
          article_id: 'IC-12',
          cost_price: 2000,
          currency: 'RSD',
          stock: [{ location: 'Beograd', quantity: 3 }],
          lead_time_days: 1,
        });
        await runImport();
        const imported = (await page('C30005'))!.part;
        const [identifier] = await catalog.listPartIdentifiers({
          part_id: imported.id,
        });
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'SRC1',
        });
        const fitment = await api.post(
          '/admin/fitments',
          { part_id: imported.id, vehicle_id: vehicle.id },
          adminHeaders,
        );
        const before = await sources();
        expect(before.Intercars).toBeGreaterThanOrEqual(2);

        const refused = await removeSource();

        expect(refused.status).toBe(400);
        expect(refused.data).toMatchObject({
          code: 'SOURCE_IN_USE',
          holders: [{ source: 'manual', rows: 1 }],
        });
        expect(await sources()).toEqual(before);

        await api.delete(
          `/admin/fitments/${fitment.data.fitment.id}`,
          adminHeaders,
        );
        const removed = await removeSource();

        expect(removed.status).toBe(200);
        expect(removed.data).toEqual({
          source: 'Intercars',
          deleted: before.Intercars,
          import_disabled: true,
        });
        const after = await sources();
        expect(after.Intercars).toBeUndefined();
        expect(after.manual).toBe(before.manual - 1);
        expect(await catalog.listParts({ id: imported.id })).toEqual([]);
        expect(
          await suppliers.listSupplierOffers({
            part_identifier_id: identifier.id,
          }),
        ).toEqual([]);
        expect(
          await suppliers.listStagedRecords({
            part_identifier_id: identifier.id,
          }),
        ).toEqual([]);
        expect((await page('HU816X'))?.offers).toHaveLength(1);

        intercars.articles.push({
          article_id: 'IC-13',
          brand: 'MANN-FILTER',
          number: 'W 1130',
          name: 'Фильтр W1130',
          category: 'IC-OIL',
        });
        const next = await runImport();

        expect(
          next.data.imports.map(
            ({ supplier }: { supplier: string }) => supplier,
          ),
        ).toEqual(['Warehouse']);
        expect(await page('W1130')).toBeUndefined();
      });

      it('keeps a staged kind the supplier leaves out and clears one it reports empty', async () => {
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const article = {
          article_id: 'IC-15',
          brand: 'MANN-FILTER',
          number: 'W 1150',
          name: 'Фильтр W1150',
          category: 'IC-OIL',
        };
        const stagedKinds = async () => {
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: (await page('W1150'))!.part.id,
          });
          return (
            await suppliers.listStagedRecords({
              part_identifier_id: identifier.id,
            })
          )
            .map(({ kind }) => kind)
            .sort();
        };
        intercars.articles.push({
          ...article,
          cross_references: [{ brand: 'BMW', number: '11 42 7 953 125' }],
          applicability: ['BMW 3 F30 320d'],
        });
        await runImport();
        expect(await stagedKinds()).toEqual([
          'applicability',
          'cross_references',
        ]);

        intercars.articles.length = 0;
        intercars.articles.push({ ...article, cross_references: [] });
        await runImport();

        expect(await stagedKinds()).toEqual(['applicability']);
      });

      it('switches a supplier import off and on again', async () => {
        const switchImport = (import_enabled: boolean) =>
          api.post(
            `/admin/suppliers/${intercarsId}`,
            { import_enabled },
            adminHeaders,
          );
        intercars.articles.push({
          article_id: 'IC-14',
          brand: 'MANN-FILTER',
          number: 'W 1140',
          name: 'Фильтр W1140',
          category: 'IC-OIL',
        });

        await switchImport(false);
        const skipped = await runImport();
        const switched = await switchImport(true);
        const imported = await runImport();

        expect(
          skipped.data.imports.map(
            ({ supplier }: { supplier: string }) => supplier,
          ),
        ).toEqual(['Warehouse']);
        expect(switched.data.supplier.import_enabled).toBe(true);
        expect(imported.data.imports[0]).toMatchObject({
          supplier: 'Intercars',
          created: 1,
        });
        expect(await page('W1140')).toBeDefined();
      });

      it('imports a supplier kept off Publish only on its own button', async () => {
        const keepOffPublish = (import_on_publish: boolean) =>
          api.post(
            `/admin/suppliers/${intercarsId}`,
            { import_on_publish },
            adminHeaders,
          );
        intercars.articles.push({
          article_id: 'IC-15',
          brand: 'MANN-FILTER',
          number: 'W 712/75',
          name: 'Фильтр W712/75',
          category: 'IC-OIL',
        });

        const switched = await keepOffPublish(false);
        const onPublish = await runImport();
        const pageAfterPublish = await page('W71275');
        const ownButton = await api.post(
          `/admin/suppliers/${intercarsId}/import`,
          {},
          adminHeaders,
        );
        await keepOffPublish(true);

        expect(switched.data.supplier.import_on_publish).toBe(false);
        expect(
          onPublish.data.imports.map(
            ({ supplier }: { supplier: string }) => supplier,
          ),
        ).toEqual(['Warehouse']);
        expect(pageAfterPublish).toBeUndefined();
        expect(ownButton.data.import).toMatchObject({
          supplier: 'Intercars',
          created: 1,
        });
        expect(await page('W71275')).toBeDefined();
      });

      it('refuses the import button for a supplier without an adapter', async () => {
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const orphan = await suppliers.createSuppliers({
          name: 'Orphan',
          markup_percentage: 0,
        });

        const response = await api
          .post(`/admin/suppliers/${orphan.id}/import`, {}, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(404);
        expect(response.data.message).toBe('No adapter reads Orphan');
      });

      it('refuses the import button for a supplier whose import is off', async () => {
        await api.post(
          `/admin/suppliers/${intercarsId}`,
          { import_enabled: false },
          adminHeaders,
        );

        const response = await api
          .post(`/admin/suppliers/${intercarsId}/import`, {}, adminHeaders)
          .catch((error) => error.response);
        await api.post(
          `/admin/suppliers/${intercarsId}`,
          { import_enabled: true },
          adminHeaders,
        );

        expect(response.status).toBe(400);
      });
    });
  },
});
