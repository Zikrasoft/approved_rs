import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../integration-tests/fakeShopAi';
import { memoryStorage } from '../../../../integration-tests/fakeStorage';
import { createFakeSupplier } from '../../../../integration-tests/fakeSupplierAdapter';
import { importRuns } from '../../../../integration-tests/importRuns';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';
import { SHOP_AI_REGISTRATION } from '../../ai';
import { seedProductionCatalogue } from '../../production-seed';
import { SHOP_STORAGE_REGISTRATION } from '../../storage';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../adapter';

const supplier = createFakeSupplier('demo-intercars');
const shopAi = createFakeShopAi();
const storage = memoryStorage();

medusaIntegrationTestRunner({
  moduleName: 'production-fields-import',
  dbName: 'medusa-production-fields-import',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([supplier.adapter]),
      );
      container.register(SHOP_AI_REGISTRATION, asValue(shopAi.ai));
      container.register(SHOP_STORAGE_REGISTRATION, asValue(storage.storage));
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('a supplier import into the production categories', () => {
      let catalog: CatalogModuleService;
      let maintenanceId: string;

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        await seedProductionCatalogue(container);
        const [maintenance] = await catalog.listCategories({
          slug: 'maintenance-consumables',
        });
        maintenanceId = maintenance.id;
        const intercars = await suppliers.createSuppliers({
          key: 'demo-intercars',
          name: 'Intercars',
          markup_percentage: 20,
        });
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        await catalog.createBrandSpellings({
          brand_id: mann.id,
          supplier_id: intercars.id,
          value: 'MANN-FILTER',
        });
        await suppliers.createSupplierCategories({
          supplier_id: intercars.id,
          code: 'IC-FILTER',
          category_id: maintenanceId,
        });
        supplier.articles.push({
          article_id: 'IC-W712',
          brand: 'MANN-FILTER',
          number: 'W 712/75',
          name: 'Filter za ulje',
          category: 'IC-FILTER',
          specs: {
            Visina: '79 mm',
            'Unutrašnji prečnik': '62 mm',
            'Bajpas ventil': 'da',
          },
        });
        shopAi.category = maintenanceId;
        shopAi.attributes = {
          'filter-type': 'spin-on',
          'inner-diameter': 62,
          'bypass-valve': true,
          base: 'synthetic',
          api: ['sn', 'cf'],
        };
        const adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@production-fields-import.local',
          'supersecret',
        );
        await importRuns(api, adminHeaders).run(intercars.id);
      });

      it('shows the AI the new fields of the category with their options', () => {
        const [{ categories }] = shopAi.articlesAsked;
        const fields =
          categories.find(({ id }) => id === maintenanceId)?.fields ?? [];
        expect(fields.map(({ key }) => key)).toEqual(
          expect.arrayContaining([
            'base',
            'acea',
            'api',
            'inner-diameter',
            'bypass-valve',
          ]),
        );
        expect(
          fields
            .find(({ key }) => key === 'base')
            ?.options.map(({ key }) => key),
        ).toEqual(['synthetic', 'semi-synthetic', 'mineral']);
      });

      it('files the part under the category with the attributes the AI read', async () => {
        const [identifier] = await catalog.listPartIdentifiers(
          { normalized_value: 'W71275' },
          { relations: ['part'] },
        );
        expect(identifier.part).toMatchObject({
          category_id: maintenanceId,
          attributes: {
            'filter-type': 'spin-on',
            'inner-diameter': 62,
            'bypass-valve': true,
            base: 'synthetic',
            api: ['sn', 'cf'],
          },
        });
      });
    });
  },
});
