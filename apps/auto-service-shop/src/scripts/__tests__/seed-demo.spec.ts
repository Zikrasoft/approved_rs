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
          await seedDemo({ container, args: [] } as never);
        } finally {
          process.env.PORT = port;
          spy.mockRestore();
        }
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

      it('points the storefront at the port the shop listens on', () => {
        expect(storefrontEnv.join('\n')).toContain(
          'MEDUSA_BACKEND_URL=http://localhost:9123',
        );
      });
    });
  },
});
