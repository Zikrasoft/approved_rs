import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import type { IRegionModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type SupplierModuleService from '../../modules/supplier/service';
import seedProduction from '../seed-production';

const LEGACY_SLUGS = [
  'body-parts',
  'brakes',
  'electrics',
  'engine-parts',
  'maintenance-consumables',
  'suspension',
  'transmission',
];

medusaIntegrationTestRunner({
  moduleName: 'seed_production',
  testSuite: ({ getContainer }) => {
    describe('The production seed', () => {
      let catalog: CatalogModuleService;
      let suppliers: SupplierModuleService;
      const run = () =>
        seedProduction({ container: getContainer(), args: [] } as never);

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        suppliers = getContainer().resolve(SUPPLIER_MODULE);
        await run();
        await run();
      });

      it('creates the seven legacy Categories once, with their copy and image', async () => {
        const categories = await catalog.listCategories(
          {},
          { order: { slug: 'ASC' } },
        );
        expect(categories.map(({ slug }) => slug)).toEqual(LEGACY_SLUGS);
        const brakes = categories.find(({ slug }) => slug === 'brakes')!;
        expect(brakes.name).toBe('Тормозная система');
        expect(brakes.text).toContain('Колодки, диски');
        expect(categories.every(({ image }) => image)).toBe(true);
      });

      it('seeds no Parts, suppliers or offers', async () => {
        expect(await catalog.listParts()).toEqual([]);
        expect(await suppliers.listSuppliers()).toEqual([]);
        expect(await suppliers.listSupplierOffers()).toEqual([]);
      });

      it('creates the commerce defaults checkout needs', async () => {
        const regions: IRegionModuleService = getContainer().resolve(
          Modules.REGION,
        );
        expect(await regions.listRegions({ name: 'Serbia' })).toHaveLength(1);
      });

      it('keeps what a person edited and restores what nobody did', async () => {
        const [brakes] = await catalog.listCategories({ slug: 'brakes' });
        const [suspension] = await catalog.listCategories({
          slug: 'suspension',
        });
        await catalog.updateCategories([
          {
            id: brakes.id,
            name: 'Тормоза',
            image: null,
            updated_by: 'user_1',
          },
          { id: suspension.id, name: 'Устаревшее имя' },
        ]);

        await run();

        const after = await catalog.retrieveCategory(brakes.id);
        expect(after.name).toBe('Тормоза');
        expect(after.image).toBeNull();
        expect((await catalog.retrieveCategory(suspension.id)).name).toBe(
          'Подвеска и рулевое',
        );
      });
    });
  },
});
