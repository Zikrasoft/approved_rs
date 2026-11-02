import fs from 'node:fs';

import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import seedDemo from '../seed-demo';
import seedProduction from '../seed-production';

medusaIntegrationTestRunner({
  moduleName: 'seed_demo',
  testSuite: ({ getContainer }) => {
    describe('The demo seed on a database the production seed and an import already filled', () => {
      let catalog: CatalogModuleService;
      const storefrontEnv: string[] = [];

      const runDemo = async () => {
        const write = fs.writeFileSync;
        const spy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation((path, data, ...rest) => {
            if (String(path).endsWith('auto-service/.env.local')) {
              storefrontEnv.push(String(data));
              return;
            }
            write(path, data, ...rest);
          });
        const port = process.env.PORT;
        process.env.PORT = '9123';
        try {
          await seedDemo({ container: getContainer(), args: [] } as never);
        } finally {
          process.env.PORT = port;
          spy.mockRestore();
        }
      };

      const partOf = async (brandSlug: string, number: string) => {
        const [brand] = await catalog.listBrands({ slug: brandSlug });
        const [identifier] = await catalog.listPartIdentifiers(
          { brand_id: brand.id, normalized_value: number },
          { relations: ['part'] },
        );
        return identifier.part;
      };

      const fieldOf = async (categorySlug: string, key: string) => {
        const [category] = await catalog.listCategories({
          slug: categorySlug,
        });
        return catalog.listCategoryFields({ category_id: category.id, key });
      };

      const attributeValues = async (categorySlug: string, key: string) => {
        const [category] = await catalog.listCategories({
          slug: categorySlug,
        });
        const parts = await catalog.listParts(
          { category_id: category.id },
          { take: null },
        );
        return parts
          .map(({ attributes }) => (attributes as Record<string, unknown>)[key])
          .filter((value) => value !== undefined)
          .map(String)
          .sort();
      };

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        await seedProduction({ container, args: [] } as never);
        const brand = async (slug: string) =>
          (await catalog.listBrands({ slug }))[0].id;
        await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр MANN-FILTER HU 816 x',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: await brand('mann-filter'),
              value: 'HU 816 x',
            },
          ],
        });
        await catalog.createPartWithIdentifiers({
          name: 'Аккумулятор VARTA 580 901 080',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: await brand('varta'),
              value: '580 901 080',
            },
          ],
        });
        await catalog.createEngines({
          code: 'B47D20',
          family: 'B47',
          fuel: 'diesel',
        });

        await runDemo();
      });

      it('reuses the crawled Brands and the Engine instead of creating them twice', async () => {
        expect(await catalog.listBrands({ slug: 'mann-filter' })).toHaveLength(
          1,
        );
        expect(await catalog.listEngines({ code: 'B47D20' })).toHaveLength(1);
      });

      it('files the demo numbers under the Part the import already made', async () => {
        const [crawled] = await catalog.listPartIdentifiers({
          normalized_value: 'HU816X',
        });
        const numbers = await catalog.listPartIdentifiers({
          part_id: crawled.part_id,
        });
        expect(numbers.map(({ normalized_value }) => normalized_value)).toEqual(
          expect.arrayContaining(['HU816X', '11428575211', 'OX404D']),
        );
      });

      it('still seeds the demo cars, batteries and suppliers', async () => {
        expect(
          await catalog.listVehicleIdentifiers({ value: '35BG' }),
        ).toHaveLength(1);
        expect(await catalog.listBrands({ slug: 'exide' })).toHaveLength(1);
        expect(
          await catalog.listPartIdentifiers({ normalized_value: 'EK700' }),
        ).toHaveLength(1);
      });

      it('lets a visitor filter engine oil by volume', async () => {
        const [oil] = await catalog.listCategories({ slug: 'engine-oil' });

        expect(
          await catalog.listCategoryFields({
            category_id: oil.id,
            key: 'volume',
          }),
        ).toEqual([expect.objectContaining({ type: 'number', facet: true })]);
      });

      it('sells the two demo oils in different volumes, so the volume filter has a choice', async () => {
        expect(await attributeValues('engine-oil', 'volume')).toEqual([
          '4',
          '4',
          '5',
        ]);
        expect((await partOf('castrol', '15F6E1')).name).toBe(
          'Моторное масло Castrol EDGE 0W-20 V, 4 л',
        );
      });

      it('marks the AGM and EFB demo batteries as Start-Stop and the standard ones as not', async () => {
        expect(await attributeValues('batteries', 'start-stop')).toEqual([
          'false',
          'false',
          'true',
          'true',
          'true',
          'true',
        ]);
      });

      it('keeps an oil filter without a gasket, so «Уплотнение» has both answers', async () => {
        expect(await attributeValues('oil-filters', 'gasket-included')).toEqual(
          expect.arrayContaining(['false', 'true']),
        );
      });

      const distinctValues = async (categorySlug: string, key: string) =>
        [
          ...new Set(
            (await attributeValues(categorySlug, key)).flatMap((value) =>
              value.split(','),
            ),
          ),
        ].sort();

      it.each([
        ['batteries', 'terminal-type', ['standard', 'thin']],
        ['batteries', 'terminal-layout', ['long-side', 'short-side']],
        ['brake-pads', 'brake-system', ['ate', 'bosch', 'lucas-trw']],
        ['engine-oil', 'base', ['semi-synthetic', 'synthetic']],
        ['engine-oil', 'acea', ['a3-b4', 'c3', 'c5']],
        ['engine-oil', 'api', ['cf', 'sn', 'sp']],
        ['oil-filters', 'bypass-valve', ['false', 'true']],
      ])(
        'gives the %s facet %s a choice of values',
        async (category, key, values) => {
          expect(await distinctValues(category, key)).toEqual(values);
        },
      );

      it.each([
        ['brake-pads', 'width'],
        ['brake-pads', 'height'],
        ['oil-filters', 'inner-diameter'],
      ])(
        'spreads the %s range %s over several values',
        async (category, key) => {
          expect(
            (await distinctValues(category, key)).length,
          ).toBeGreaterThanOrEqual(2);
        },
      );

      it('names the febi Brand «Febi» while its slug stays febi', async () => {
        expect(await catalog.listBrands({ slug: 'febi' })).toEqual([
          expect.objectContaining({ name: 'Febi' }),
        ]);
      });

      it('brings an already seeded demo catalogue up to date and keeps what a person edited', async () => {
        const [volume] = await fieldOf('engine-oil', 'volume');
        const [height] = await fieldOf('oil-filters', 'height');
        await catalog.updateCategoryFields([
          { id: volume.id, facet: false },
          { id: height.id, facet: false, updated_by: 'user_1' },
        ]);
        const oil = await partOf('castrol', '15F6E1');
        await catalog.classifyPart(oil.id, {
          category_id: oil.category_id,
          attributes: { ...oil.attributes, volume: 5 },
        });
        await catalog.updateParts({
          id: oil.id,
          name: 'Моторное масло Castrol EDGE 0W-20 V, 5 л',
        });
        const battery = await partOf('exide', 'EK700');
        const withoutStartStop = Object.fromEntries(
          Object.entries(battery.attributes as object).filter(
            ([key]) => key !== 'start-stop',
          ),
        );
        await catalog.classifyPart(battery.id, {
          category_id: battery.category_id,
          attributes: withoutStartStop,
        });
        const hengst = await partOf('hengst', 'E340HD247');
        await catalog.classifyPart(hengst.id, {
          category_id: hengst.category_id,
          attributes: Object.fromEntries(
            Object.entries(hengst.attributes as object).filter(
              ([key]) => key !== 'bypass-valve',
            ),
          ),
        });
        const brembo = await partOf('brembo', 'P06038');
        await catalog.classifyPart(brembo.id, {
          category_id: brembo.category_id,
          attributes: { ...brembo.attributes, 'brake-system': 'akebono' },
          updated_by: 'user_1',
        });
        const pads = await partOf('textar', '2459801');
        await catalog.classifyPart(pads.id, {
          category_id: pads.category_id,
          attributes: { ...pads.attributes, thickness: 18 },
          updated_by: 'user_1',
        });

        await runDemo();

        expect(await fieldOf('engine-oil', 'volume')).toEqual([
          expect.objectContaining({ id: volume.id, facet: true }),
        ]);
        expect(await fieldOf('oil-filters', 'height')).toEqual([
          expect.objectContaining({ id: height.id, facet: false }),
        ]);
        expect(await partOf('castrol', '15F6E1')).toEqual(
          expect.objectContaining({
            name: 'Моторное масло Castrol EDGE 0W-20 V, 4 л',
            attributes: expect.objectContaining({ volume: 4 }),
          }),
        );
        expect((await partOf('exide', 'EK700')).attributes).toEqual(
          expect.objectContaining({ 'start-stop': true }),
        );
        expect((await partOf('textar', '2459801')).attributes).toEqual(
          expect.objectContaining({ thickness: 18 }),
        );
        expect((await partOf('hengst', 'E340HD247')).attributes).toEqual(
          expect.objectContaining({ 'bypass-valve': false }),
        );
        expect((await partOf('brembo', 'P06038')).attributes).toEqual(
          expect.objectContaining({ 'brake-system': 'akebono' }),
        );
      });

      it('points the storefront at the port the shop listens on', () => {
        expect(storefrontEnv.join('\n')).toContain(
          'MEDUSA_BACKEND_URL=http://localhost:9123',
        );
      });
    });
  },
});
