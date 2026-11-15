import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type SupplierModuleService from '../../modules/supplier/service';
import seedProduction from '../seed-production';

medusaIntegrationTestRunner({
  moduleName: 'seed_production_renames',
  testSuite: ({ getContainer }) => {
    describe('the production seed over the earlier engine and suspension Categories', () => {
      let catalog: CatalogModuleService;
      let suppliers: SupplierModuleService;
      let suspensionId: string;
      let engineId: string;
      const run = () =>
        seedProduction({ container: getContainer(), args: [] } as never);
      const mappedTo = async (code: string) =>
        (
          await suppliers.listSupplierCategories(
            { code },
            { select: ['category_id'] },
          )
        )[0].category_id;
      const slugOf = async (id: string | null) =>
        (await catalog.retrieveCategory(id!)).slug;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        suppliers = getContainer().resolve(SUPPLIER_MODULE);
        const [suspension, engine] = await catalog.createCategories([
          {
            slug: 'suspension',
            name: 'Подвеска и рулевое',
            text: 'От стука в подвеске до замены рулевых наконечников.',
          },
          {
            slug: 'engine-parts',
            name: 'Двигатель',
            text: 'Запчасти для двигателя.',
            updated_by: 'user_1',
          },
        ]);
        suspensionId = suspension.id;
        engineId = engine.id;
        const bilstein = await suppliers.createSuppliers({
          key: 'bilstein',
          name: 'bilstein group',
          markup_percentage: 0,
        });
        await suppliers.createSupplierCategories(
          [
            ['rame', suspension.id],
            ['amortizer', suspension.id],
            ['nosač ramena', suspension.id],
            ['kanalni kaiš', engine.id],
            ['zupčasti kaiš', engine.id],
          ].map(([code, category_id]) => ({
            supplier_id: bilstein.id,
            code,
            category_id,
          })),
        );
        await run();
        await run();
      });

      it('renames the two Categories in place and leaves no Category on the old slugs', async () => {
        expect(await catalog.retrieveCategory(suspensionId)).toMatchObject({
          slug: 'control-arms',
          name: 'Рычаги подвески',
          updated_by: null,
        });
        expect(await catalog.retrieveCategory(engineId)).toMatchObject({
          slug: 'poly-v-belts',
          name: 'Двигатель',
          updated_by: 'user_1',
        });
        expect(
          await catalog.listCategories({
            slug: ['suspension', 'engine-parts'],
          }),
        ).toEqual([]);
        expect(await catalog.listCategories({}, { take: null })).toHaveLength(
          12,
        );
      });

      it('redirects each old slug to its renamed Category, once', async () => {
        const redirects = await catalog.listSlugRedirects(
          { kind: 'category' },
          { take: null },
        );
        expect(
          redirects.map(({ from_slug, from_id }) => [from_slug, from_id]),
        ).toEqual(
          expect.arrayContaining([
            ['suspension', suspensionId],
            ['engine-parts', engineId],
          ]),
        );
        expect(redirects).toHaveLength(2);
      });

      it('keeps the renamed Categories on their codes and moves the rest to the new ones', async () => {
        expect(await mappedTo('rame')).toBe(suspensionId);
        expect(await mappedTo('kanalni kaiš')).toBe(engineId);
        expect(await slugOf(await mappedTo('amortizer'))).toBe(
          'shock-absorbers',
        );
        expect(await slugOf(await mappedTo('nosač ramena'))).toBe('bushings');
        expect(await slugOf(await mappedTo('zupčasti kaiš'))).toBe(
          'timing-belts',
        );
      });

      it('gives the renamed Categories their new fields', async () => {
        const keys = async (category_id: string) =>
          (
            await catalog.listCategoryFields(
              { category_id },
              { order: { rank: 'ASC' } },
            )
          ).map(({ key }) => key);
        expect(await keys(suspensionId)).toEqual([
          'axle',
          'side',
          'position',
          'ball-joint',
          'material',
        ]);
        expect(await keys(engineId)).toEqual(['ribs', 'length', 'type']);
      });
    });
  },
});
