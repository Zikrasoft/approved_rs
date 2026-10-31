import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { CATALOG_MODULE } from '..';
import type CatalogModuleService from '../service';

medusaIntegrationTestRunner({
  moduleName: 'find_or_create_part',
  testSuite: ({ getContainer }) => {
    describe('Finding or creating a Part by its Brand-number', () => {
      let catalog: CatalogModuleService;
      let brandId: string;

      const part = (value: string, name = 'Oil filter') => ({
        name,
        identifier: {
          type: 'manufacturer-number' as const,
          brand_id: brandId,
          value,
        },
        source: 'test',
      });

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        brandId = (await catalog.createBrands({ name: 'MANN', slug: 'mann' }))
          .id;
      });

      it('creates the Part and its number when the number is new', async () => {
        const found = await catalog.findOrCreatePart(part('W 712/75'));

        expect(found.created).toBe(true);
        const [identifier] = await catalog.listPartIdentifiers(
          { id: found.part_identifier_id },
          { relations: ['part'] },
        );
        expect(identifier).toMatchObject({
          value: 'W 712/75',
          part_id: found.part_id,
          part: { name: 'Oil filter', source: 'test' },
        });
      });

      it('finds the Part that already has the number, however it is spelled', async () => {
        const first = await catalog.findOrCreatePart(part('HU 816 x'));

        const again = await catalog.findOrCreatePart(
          part('hu816x', 'Another name'),
        );

        expect(again).toEqual({
          part_id: first.part_id,
          part_identifier_id: first.part_identifier_id,
          created: false,
        });
        expect(
          await catalog.listPartIdentifiers({ part_id: first.part_id }),
        ).toHaveLength(1);
      });

      it('resolves two writers racing on one number to a single Part', async () => {
        const raced = await Promise.all(
          Array.from({ length: 4 }, () =>
            catalog.findOrCreatePart(part('C 30 005')),
          ),
        );

        expect(raced.filter(({ created }) => created)).toHaveLength(1);
        expect(new Set(raced.map(({ part_id }) => part_id)).size).toBe(1);
        expect(
          await catalog.listPartIdentifiers({ normalized_value: 'C30005' }),
        ).toHaveLength(1);
      });
    });
  },
});
