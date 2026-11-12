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

const mann = createFakeSupplier('mann-filter');
const bilstein = createFakeSupplier('bilstein');
const shopAi = createFakeShopAi();
const storage = memoryStorage();

medusaIntegrationTestRunner({
  moduleName: 'part-types-import',
  dbName: 'medusa-part-types-import',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([mann.adapter, bilstein.adapter]),
      );
      container.register(SHOP_AI_REGISTRATION, asValue(shopAi.ai));
      container.register(SHOP_STORAGE_REGISTRATION, asValue(storage.storage));
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('part type names on a supplier import', () => {
      let catalog: CatalogModuleService;
      let run: (key: string) => Promise<unknown>;

      const partOf = async (normalized: string) => {
        const [identifier] = await catalog.listPartIdentifiers(
          { normalized_value: normalized },
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
        const adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@part-types-import.local',
          'supersecret',
        );
        const runs = importRuns(api, adminHeaders);
        run = async (key) => runs.run((await suppliers.supplierByKey(key))!.id);
        mann.articles.push({
          article_id: 'CUK 2939',
          brand: 'MANN-FILTER',
          number: 'CUK 2939',
          name: 'CUK 2939',
          category: 'Cabin Air Filter | Activated carbon',
        });
        bilstein.articles.push({
          article_id: '17532',
          brand: 'febi',
          number: '17532',
          name: 'filter kabine',
          category: 'filter kabine',
        });
        shopAi.name = 'Фильтр салона угольный';
        await run('mann-filter');
        await run('bilstein');
      });

      it('names a Part by the one type its supplier category stands for, whatever the AI calls it', async () => {
        expect((await partOf('CUK2939')).name).toBe(
          'Салонный фильтр MANN-FILTER CUK 2939',
        );
        expect((await partOf('17532')).name).toBe('Салонный фильтр febi 17532');
      });

      it('renames a Part imported under another name for its type', async () => {
        const part = await partOf('CUK2939');
        await catalog.updateParts({
          id: part.id,
          name: 'Фильтр салона MANN-FILTER CUK 2939',
        });

        await run('mann-filter');

        expect((await partOf('CUK2939')).name).toBe(
          'Салонный фильтр MANN-FILTER CUK 2939',
        );
      });

      it('keeps a name staff edited by hand', async () => {
        const part = await partOf('CUK2939');
        await catalog.updateParts({
          id: part.id,
          name: 'Угольный салонный фильтр',
          edited_fields: ['name'],
        });

        await run('mann-filter');

        expect((await partOf('CUK2939')).name).toBe('Угольный салонный фильтр');
      });
    });
  },
});
