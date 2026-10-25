import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import type { IRegionModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type SupplierModuleService from '../../modules/supplier/service';
import seedProduction from '../seed-production';

const SLUGS = [
  'batteries',
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

      it('creates the eight Categories once, with their copy and every photo it ships', async () => {
        const categories = await catalog.listCategories(
          {},
          { order: { slug: 'ASC' } },
        );
        expect(categories.map(({ slug }) => slug)).toEqual(SLUGS);
        const brakes = categories.find(({ slug }) => slug === 'brakes')!;
        expect(brakes.name).toBe('Тормозная система');
        expect(brakes.text).toContain('Колодки, диски');
        expect(
          categories
            .filter(({ slug }) => slug !== 'batteries')
            .every(({ image }) => image),
        ).toBe(true);
      });

      it('creates the batteries Category with its registration service', async () => {
        const [batteries] = await catalog.listCategories({ slug: 'batteries' });
        expect(batteries).toMatchObject({
          name: 'Аккумуляторы',
          service_label: 'Регистрация аккумулятора в блоке управления',
          service_price: 2500,
        });
        expect(batteries.service_note).toContain('зарегистрировать');
      });

      it('creates the battery fields and their options once', async () => {
        const [batteries] = await catalog.listCategories({ slug: 'batteries' });
        const fields = await catalog.listCategoryFields(
          { category_id: batteries.id },
          { order: { rank: 'ASC' }, take: null },
        );
        expect(fields.map(({ key }) => key)).toEqual([
          'capacity',
          'cold-cranking',
          'voltage',
          'technology',
          'polarity',
          'case-size',
          'length',
          'width',
          'height',
        ]);
        expect(fields[0]).toMatchObject({
          type: 'number',
          label: 'Емкость',
          unit: 'А·ч',
          facet: true,
          required: true,
        });
        const technology = fields.find(({ key }) => key === 'technology')!;
        const options = await catalog.listCategoryFieldOptions(
          { field_id: technology.id },
          { order: { rank: 'ASC' } },
        );
        expect(options.map(({ key, label }) => [key, label])).toEqual([
          ['standard', 'Обычный'],
          ['efb', 'EFB'],
          ['agm', 'AGM'],
        ]);
      });

      it('seeds no Parts or offers', async () => {
        expect(await catalog.listParts()).toEqual([]);
        expect(await suppliers.listSupplierOffers()).toEqual([]);
      });

      it('registers each crawled site once as a Supplier imported only on its own button', async () => {
        const registered = await suppliers.listSuppliers();
        expect(registered.map(({ name }) => name).sort()).toEqual([
          'MANN-FILTER',
          'VARTA',
          'bilstein group',
        ]);
        expect(
          registered.every(
            ({ import_enabled, import_on_publish }) =>
              import_enabled && !import_on_publish,
          ),
        ).toBe(true);
      });

      it('creates the commerce defaults checkout needs', async () => {
        const regions: IRegionModuleService = getContainer().resolve(
          Modules.REGION,
        );
        expect(await regions.listRegions({ name: 'Serbia' })).toHaveLength(1);
      });

      it('names the store CarLab instead of the Medusa default', async () => {
        const stores = await getContainer().resolve(Modules.STORE).listStores();
        expect(stores.map(({ name }) => name)).toEqual(['CarLab']);
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

      it('keeps an edited battery field or option and restores the rest', async () => {
        const [batteries] = await catalog.listCategories({ slug: 'batteries' });
        const fields = await catalog.listCategoryFields({
          category_id: batteries.id,
        });
        const field = (key: string) => fields.find((f) => f.key === key)!;
        const [agm] = await catalog.listCategoryFieldOptions({
          field_id: field('technology').id,
          key: 'agm',
        });
        await catalog.updateCategoryFields([
          {
            id: field('capacity').id,
            label: 'Емкость, А·ч',
            updated_by: 'user_1',
          },
          { id: field('voltage').id, label: 'Вольтаж' },
        ]);
        await catalog.updateCategoryFieldOptions({ id: agm.id, label: 'АГМ' });
        await catalog.updateCategories({
          id: batteries.id,
          service_price: 3000,
          updated_by: 'user_1',
        });

        await run();

        expect(
          (await catalog.retrieveCategoryField(field('capacity').id)).label,
        ).toBe('Емкость, А·ч');
        expect(
          (await catalog.retrieveCategoryField(field('voltage').id)).label,
        ).toBe('Напряжение');
        expect((await catalog.retrieveCategoryFieldOption(agm.id)).label).toBe(
          'AGM',
        );
        expect(
          (await catalog.retrieveCategory(batteries.id)).service_price,
        ).toBe(3000);
      });
    });
  },
});
