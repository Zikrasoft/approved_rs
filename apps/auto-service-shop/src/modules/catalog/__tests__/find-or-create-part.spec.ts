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

      it('refuses a number that keeps no Latin letter or digit', async () => {
        await expect(
          catalog.findOrCreatePart(part('—/—')),
        ).rejects.toMatchObject({ code: 'INVALID_FIELD' });
      });

      it('refuses a number staff deleted with its Part, however it is spelled', async () => {
        const { part_id } = await catalog.findOrCreatePart(part('W 719/30'));

        await catalog.deletePartRejectingNumbers(part_id);

        expect(await catalog.isRejectedNumber(brandId, 'w719-30')).toBe(true);
        await expect(
          catalog.findOrCreatePart(part('W71930')),
        ).rejects.toMatchObject({ code: 'REJECTED_NUMBER' });
        expect(
          await catalog.listPartIdentifiers({ normalized_value: 'W71930' }),
        ).toHaveLength(0);
      });

      it('takes a rejected number back when staff create its Part by hand', async () => {
        const { part_id } = await catalog.findOrCreatePart(part('W 811/80'));
        await catalog.deletePartRejectingNumbers(part_id);

        await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: brandId,
              value: 'W 811/80',
            },
          ],
        });

        expect(await catalog.isRejectedNumber(brandId, 'W 811/80')).toBe(false);
      });

      it('rejects nothing for another Brand', async () => {
        const { part_id } = await catalog.findOrCreatePart(part('W 920/21'));
        await catalog.deletePartRejectingNumbers(part_id);
        const other = await catalog.createBrands({
          name: 'Bosch',
          slug: 'bosch',
        });

        expect(await catalog.isRejectedNumber(other.id, 'W 920/21')).toBe(
          false,
        );
      });
    });

    describe('Finding a Brand by any name', () => {
      let catalog: CatalogModuleService;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      it('finds a Brand by a global alias, then by its name however it is spelled, then by a Supplier spelling', async () => {
        const febi = await catalog.createBrands({ name: 'Febi', slug: 'febi' });
        const lemforder = await catalog.createBrands({
          name: 'Lemförder',
          slug: 'lemforder',
        });
        const reinz = await catalog.createBrands({
          name: 'Victor Reinz',
          slug: 'victor-reinz',
        });
        await catalog.createBrandSpellings([
          { supplier_id: null, value: 'febi bilstein', brand_id: febi.id },
          { supplier_id: null, value: 'Reinz', brand_id: reinz.id },
          { supplier_id: 'sup_1', value: 'LMI', brand_id: lemforder.id },
        ]);

        const found = async (name: string) =>
          (await catalog.brandByAnyName(name))?.id ?? null;

        expect(await found('FEBI')).toBe(febi.id);
        expect(await found('Febi Bilstein')).toBe(febi.id);
        expect(await found('FEBI-BILSTEIN')).toBe(febi.id);
        expect(await found('LEMFORDER')).toBe(lemforder.id);
        expect(await found('victor reinz')).toBe(reinz.id);
        expect(await found('REINZ')).toBe(reinz.id);
        expect(await found('lmi')).toBe(lemforder.id);
        expect(await found('Bilstein')).toBeNull();
      });

      it('finds the Brand a global alias names before another Brand spelled like the alias', async () => {
        const mahle = await catalog.createBrands({
          name: 'MAHLE',
          slug: 'mahle',
        });
        await catalog.createBrands({ name: 'Knecht', slug: 'knecht' });
        await catalog.createBrandSpellings({
          supplier_id: null,
          value: 'Knecht',
          brand_id: mahle.id,
        });

        expect(await catalog.brandByAnyName('KNECHT')).toMatchObject({
          id: mahle.id,
          name: 'MAHLE',
        });
      });
    });
  },
});
