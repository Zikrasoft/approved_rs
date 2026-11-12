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
import {
  BATTERY_CATEGORY,
  seedProductionCatalogue,
} from '../../production-seed';
import { SHOP_STORAGE_REGISTRATION } from '../../storage';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../adapter';

const supplier = createFakeSupplier('demo-intercars');
const shopAi = createFakeShopAi();
const storage = memoryStorage();
const COMPOSED = 'Аккумулятор 12 В 60 А·ч 540 А VARTA 560408054';

medusaIntegrationTestRunner({
  moduleName: 'battery-names-import',
  dbName: 'medusa-battery-names-import',
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
    describe('battery names on a supplier import', () => {
      let catalog: CatalogModuleService;
      let run: () => Promise<unknown>;

      const battery = async () => {
        const [identifier] = await catalog.listPartIdentifiers(
          { normalized_value: '560408054' },
          { relations: ['part'] },
        );
        return identifier.part;
      };

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        await seedProductionCatalogue(container);
        const [batteries] = await catalog.listCategories({
          slug: BATTERY_CATEGORY.slug,
        });
        const intercars = await suppliers.createSuppliers({
          key: 'demo-intercars',
          name: 'Intercars',
          markup_percentage: 20,
        });
        const [varta] = await catalog.listBrands({ slug: 'varta' });
        await catalog.createBrandSpellings({
          brand_id: varta.id,
          supplier_id: intercars.id,
          value: 'VARTA',
        });
        await suppliers.createSupplierCategories({
          supplier_id: intercars.id,
          code: 'IC-BATTERY',
          category_id: batteries.id,
        });
        supplier.articles.push({
          article_id: 'IC-560408054',
          brand: 'VARTA',
          number: '560408054',
          name: 'Akumulator',
          category: 'IC-BATTERY',
          specs: { Kapacitet: '60 Ah', 'Startna struja': '540 A' },
        });
        shopAi.name = 'Аккумулятор';
        shopAi.attributes = {
          voltage: 12,
          capacity: 60,
          'cold-cranking': 540,
          technology: 'standard',
          'start-stop': false,
        };
        const adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@battery-names-import.local',
          'supersecret',
        );
        run = () => importRuns(api, adminHeaders).run(intercars.id);
        await run();
      });

      it('names a new battery from its attributes', async () => {
        expect((await battery()).name).toBe(COMPOSED);
      });

      it('renames a battery imported under the old free-form name', async () => {
        const part = await battery();
        await catalog.updateParts({
          id: part.id,
          name: 'Аккумулятор VARTA 560408054',
        });

        await run();

        expect((await battery()).name).toBe(COMPOSED);
      });

      it('keeps a name staff edited by hand', async () => {
        const part = await battery();
        await catalog.updateParts({
          id: part.id,
          name: 'VARTA Blue Dynamic E43',
          edited_fields: ['name'],
        });

        await run();

        expect((await battery()).name).toBe('VARTA Blue Dynamic E43');
      });
    });
  },
});
