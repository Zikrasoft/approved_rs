import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { seedCategoryFields } from '../../../lib/production-seed';
import { CATALOG_MODULE } from '..';
import type CatalogModuleService from '../service';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

medusaIntegrationTestRunner({
  moduleName: 'catalog_integrity',
  testSuite: ({ getContainer }) => {
    let catalog: CatalogModuleService;
    let brandId: string;
    let serial = 0;

    const oilCategory = async (source = 'manual') => {
      serial += 1;
      const category = await catalog.createCategories({
        name: `Масло ${serial}`,
        source,
      });
      const viscosity = await catalog.createCategoryFields({
        category_id: category.id,
        key: 'viscosity',
        type: 'single-select',
        label: 'Вязкость',
        source,
      });
      const [thin, thick] = await catalog.createCategoryFieldOptions([
        { field_id: viscosity.id, key: '0w-20', label: '0W-20', source },
        { field_id: viscosity.id, key: '5w-30', label: '5W-30', source },
      ]);
      return { category, viscosity, thin, thick };
    };

    const part = async (fields: Record<string, unknown> = {}) => {
      serial += 1;
      return catalog.createPartWithIdentifiers({
        name: `Part ${serial}`,
        identifiers: [
          {
            type: 'manufacturer-number',
            brand_id: brandId,
            value: `INT-${serial}`,
          },
        ],
        ...fields,
      });
    };

    const holdingLock = async (
      lock: (context: Context) => Promise<unknown>,
      contender: () => Promise<unknown>,
    ) => {
      let raced: Promise<unknown> = Promise.resolve();
      await catalog.transaction(async (context) => {
        await lock(context);
        raced = contender().then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await pause(500);
      });
      return raced as Promise<{ value?: unknown; error?: unknown }>;
    };

    beforeAll(async () => {
      catalog = getContainer().resolve(CATALOG_MODULE);
      brandId = (
        await catalog.createBrands({ name: 'Integrity', slug: 'integrity' })
      ).id;
    });

    describe('editing a Part', () => {
      it('applies a staff edit in one go and marks the fields a person owns', async () => {
        const { category } = await oilCategory();
        const replacement = await part();
        const id = await part();

        await catalog.editPart(
          id,
          {
            name: 'Staff name',
            description: 'Staff text',
            category_id: category.id,
            attributes: { viscosity: '0w-20' },
            replaced_by_id: replacement,
            installation_price: 500,
          },
          'user_staff',
        );

        expect(await catalog.retrievePart(id)).toMatchObject({
          name: 'Staff name',
          description: 'Staff text',
          category_id: category.id,
          attributes: { viscosity: '0w-20' },
          replaced_by_id: replacement,
          installation_price: 500,
          updated_by: 'user_staff',
          edited_fields: expect.arrayContaining([
            'name',
            'description',
            'category_id',
          ]),
        });
      });

      it('keeps the attributes while the Category stays and clears them when it changes', async () => {
        const first = await oilCategory();
        const second = await oilCategory();
        const id = await part({
          category_id: first.category.id,
          attributes: { viscosity: '5w-30' },
        });

        await catalog.editPart(id, { category_id: first.category.id }, null);
        const kept = (await catalog.retrievePart(id)).attributes;
        await catalog.editPart(id, { category_id: second.category.id }, null);

        expect(kept).toEqual({ viscosity: '5w-30' });
        expect((await catalog.retrievePart(id)).attributes).toEqual({});
      });

      it('rolls the whole edit back when its attributes break the Category', async () => {
        const { category } = await oilCategory();
        const id = await part();

        await expect(
          catalog.editPart(
            id,
            {
              name: 'Never saved',
              category_id: category.id,
              attributes: { viscosity: 'nope' },
            },
            'user_staff',
          ),
        ).rejects.toMatchObject({ code: 'INVALID_ATTRIBUTES' });

        expect(await catalog.retrievePart(id)).toMatchObject({
          name: expect.stringMatching(/^Part /),
          category_id: null,
          edited_fields: [],
          updated_by: null,
        });
      });

      it('keeps the marks of two staff edits saved at the same moment', async () => {
        const id = await part();

        await Promise.all([
          catalog.editPart(id, { name: 'Renamed' }, 'user_a'),
          catalog.editPart(id, { description: 'Described' }, 'user_b'),
        ]);

        expect((await catalog.retrievePart(id)).edited_fields.sort()).toEqual([
          'description',
          'name',
        ]);
      });
    });

    describe('a change from a source', () => {
      it('fills only what no person owns', async () => {
        const { category } = await oilCategory();
        const id = await part();
        await catalog.editPart(id, { name: 'Staff name' }, 'user_staff');

        const applied = await catalog.applySourceChange(id, {
          name: 'AI name',
          source_name: 'Feed name',
          description: 'AI text',
          classification: {
            category_id: category.id,
            attributes: { viscosity: '0w-20' },
          },
        });

        expect(applied).toEqual({ changed: true });
        expect(await catalog.retrievePart(id)).toMatchObject({
          name: 'Staff name',
          source_name: null,
          description: 'AI text',
          category_id: category.id,
          attributes: { viscosity: '0w-20' },
        });
      });

      it('never files a Part a person filed, nor rewrites a description', async () => {
        const first = await oilCategory();
        const second = await oilCategory();
        const id = await part();
        await catalog.editPart(id, { category_id: first.category.id }, null);
        await catalog.updateParts({ id, description: 'Earlier text' });

        const applied = await catalog.applySourceChange(id, {
          description: 'AI text',
          classification: { category_id: second.category.id, attributes: {} },
        });

        expect(applied).toEqual({ changed: false });
        expect(await catalog.retrievePart(id)).toMatchObject({
          category_id: first.category.id,
          description: 'Earlier text',
        });
      });

      it('leaves a Part unfiled when the Category refuses its attributes, and still renames it', async () => {
        const { category } = await oilCategory();
        const id = await part();

        const applied = await catalog.applySourceChange(id, {
          name: 'AI name',
          classification: {
            category_id: category.id,
            attributes: { viscosity: 'nope' },
          },
        });

        expect(applied).toEqual({ changed: true });
        expect(await catalog.retrievePart(id)).toMatchObject({
          name: 'AI name',
          category_id: null,
        });
      });

      it('changes nothing for a classification without a Category', async () => {
        const id = await part();

        expect(
          await catalog.applySourceChange(id, {
            classification: { category_id: null, attributes: {} },
          }),
        ).toEqual({ changed: false });
      });

      it('refreshes the attributes of a Part filed under the same Category, and only when they change', async () => {
        const { category } = await oilCategory();
        const id = await part();
        const classified = (viscosity: string) => ({
          classification: {
            category_id: category.id,
            attributes: { viscosity },
          },
        });
        await catalog.applySourceChange(id, classified('0w-20'));

        const same = await catalog.applySourceChange(id, classified('0w-20'));
        const moved = await catalog.applySourceChange(id, classified('5w-30'));
        const refused = await catalog.applySourceChange(id, classified('nope'));

        expect([same, moved, refused]).toEqual([
          { changed: false },
          { changed: true },
          { changed: false },
        ]);
        expect((await catalog.retrievePart(id)).attributes).toEqual({
          viscosity: '5w-30',
        });
      });

      it('never refreshes attributes a person edited', async () => {
        const { category } = await oilCategory();
        const id = await part();
        await catalog.editPart(
          id,
          { category_id: category.id, attributes: { viscosity: '0w-20' } },
          'user_staff',
        );

        const applied = await catalog.applySourceChange(id, {
          classification: {
            category_id: category.id,
            attributes: { viscosity: '5w-30' },
          },
        });

        expect(applied).toEqual({ changed: false });
        expect(await catalog.retrievePart(id)).toMatchObject({
          attributes: { viscosity: '0w-20' },
          edited_fields: expect.arrayContaining(['attributes']),
        });
      });

      it('passes on an error other than a refusal of the attributes', async () => {
        const id = await part();

        await expect(
          catalog.applySourceChange(id, {
            classification: { category_id: 'cat_missing', attributes: {} },
          }),
        ).rejects.toMatchObject({ type: 'not_found' });
      });

      it('never overwrites a staff edit saved while the source was being read', async () => {
        const id = await part();

        const raced = await holdingLock(
          (context) =>
            catalog.editPart(id, { name: 'Staff name' }, 'user_staff', context),
          () =>
            catalog.applySourceChange(id, {
              name: 'AI name',
              source_name: 'Feed name',
            }),
        );

        expect(raced).toEqual({
          value: { changed: false },
        });
        expect((await catalog.retrievePart(id)).name).toBe('Staff name');
      });
    });

    describe('a Category definition', () => {
      it('refuses every change that breaks its Parts, whoever makes it', async () => {
        const { category, viscosity, thick } = await oilCategory();
        await part({
          category_id: category.id,
          attributes: { viscosity: '5w-30' },
        });

        const refusals: unknown[] = [];
        for (const change of [
          () =>
            catalog.createCategoryFields({
              category_id: category.id,
              key: 'volume',
              type: 'number',
              label: 'Объем',
              required: true,
            }),
          () =>
            catalog.updateCategoryFields({ id: viscosity.id, type: 'number' }),
          () => catalog.deleteCategoryFields(viscosity.id),
          () => catalog.deleteCategoryFieldOptions(thick.id),
        ]) {
          refusals.push(await change().catch((error: unknown) => error));
        }

        expect(refusals).toEqual(
          Array(4).fill(
            expect.objectContaining({ code: 'DEFINITION_BREAKS_PARTS' }),
          ),
        );
        expect(await catalog.categoryDefinition(category.id)).toEqual([
          expect.objectContaining({
            key: 'viscosity',
            type: 'single-select',
            options: [{ key: '0w-20' }, { key: '5w-30' }],
          }),
        ]);
      });

      it('makes a change no Part depends on', async () => {
        const { category, viscosity, thin } = await oilCategory();
        await part({
          category_id: category.id,
          attributes: { viscosity: '5w-30' },
        });

        await catalog.createCategoryFields([
          {
            category_id: category.id,
            key: 'volume',
            type: 'number',
            label: 'Объем',
          },
          {
            category_id: category.id,
            key: 'colour',
            type: 'text',
            label: 'Цвет',
          },
        ]);
        await catalog.updateCategoryFields({
          id: viscosity.id,
          required: true,
        });
        await catalog.deleteCategoryFieldOptions(thin.id);

        expect(await catalog.categoryDefinition(category.id)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'viscosity',
              required: true,
              options: [{ key: '5w-30' }],
            }),
            expect.objectContaining({ key: 'volume' }),
            expect.objectContaining({ key: 'colour' }),
          ]),
        );
      });

      it('refuses retyping or deleting a field or an option a Requirement uses', async () => {
        const { viscosity, thin } = await oilCategory();
        const { engine } = await createVehicleFixture(catalog, {
          engineCode: 'REQ1',
          typeCode: 'REQ1',
        });
        await catalog.createRequirement({
          field_id: viscosity.id,
          engine_id: engine.id,
          option_keys: ['0w-20'],
          min: null,
          max: null,
          quantity: 1,
        });

        const refusals: unknown[] = [];
        for (const change of [
          () =>
            catalog.updateCategoryFields({ id: viscosity.id, type: 'text' }),
          () => catalog.deleteCategoryFields(viscosity.id),
          () => catalog.deleteCategoryFieldOptions(thin.id),
        ]) {
          refusals.push(await change().catch((error: unknown) => error));
        }

        expect(refusals).toEqual(
          Array(3).fill(
            expect.objectContaining({ code: 'REQUIREMENT_IN_USE' }),
          ),
        );
      });

      it('makes a classification wait for a definition change on its Category', async () => {
        const { category, thick } = await oilCategory();
        const id = await part();

        const raced = await holdingLock(
          (context) => catalog.deleteCategoryFieldOptions(thick.id, context),
          () =>
            catalog.classifyPart(id, {
              category_id: category.id,
              attributes: { viscosity: '5w-30' },
            }),
        );

        expect(raced.error).toMatchObject({ code: 'INVALID_ATTRIBUTES' });
        expect((await catalog.retrievePart(id)).category_id).toBeNull();
      });

      it('lets the production seed log a refused field and carry on', async () => {
        const { category } = await oilCategory();
        await part({
          category_id: category.id,
          attributes: { viscosity: '5w-30' },
        });
        const warned: string[] = [];
        const definitions = [
          {
            key: 'viscosity',
            type: 'number' as const,
            label: 'Вязкость',
            unit: null,
            required: false,
            facet: false,
            options: [],
          },
          {
            key: 'volume',
            type: 'number' as const,
            label: 'Объем',
            unit: 'l',
            required: true,
            facet: false,
            options: [],
          },
          {
            key: 'colour',
            type: 'text' as const,
            label: 'Цвет',
            unit: null,
            required: false,
            facet: false,
            options: [],
          },
        ];

        const ids = await seedCategoryFields(
          catalog,
          category.id,
          definitions,
          {
            warn: (message: string) => warned.push(message),
          },
        );

        expect(Object.keys(ids).sort()).toEqual(['colour', 'viscosity']);
        expect(warned).toEqual([
          expect.stringContaining('viscosity'),
          expect.stringContaining('volume'),
        ]);
        expect(
          (await catalog.categoryDefinition(category.id)).find(
            ({ key }) => key === 'viscosity',
          ),
        ).toMatchObject({ type: 'single-select' });
        await expect(
          seedCategoryFields(catalog, category.id, definitions),
        ).rejects.toMatchObject({ code: 'DEFINITION_BREAKS_PARTS' });
      });
    });

    describe('deleting a source', () => {
      it('keeps a field and its options while another source still uses them, and removes nothing', async () => {
        const { category } = await oilCategory('feed-a');
        const feedPart = await part({ source: 'feed-a' });
        await part({
          category_id: category.id,
          attributes: { viscosity: '5w-30' },
        });

        await expect(
          catalog.deleteRowsBySource('feed-a'),
        ).rejects.toMatchObject({
          code: 'SOURCE_IN_USE',
        });

        expect(await catalog.categoryDefinition(category.id)).toEqual([
          expect.objectContaining({
            options: [{ key: '0w-20' }, { key: '5w-30' }],
          }),
        ]);
        expect(await catalog.listParts({ id: feedPart })).toHaveLength(1);
      });

      it('names the field a Requirement of another source uses', async () => {
        const { viscosity } = await oilCategory('feed-b');
        const { engine } = await createVehicleFixture(catalog, {
          engineCode: 'REQ2',
          typeCode: 'REQ2',
        });
        await catalog.createRequirement({
          field_id: viscosity.id,
          engine_id: engine.id,
          option_keys: ['0w-20'],
          min: null,
          max: null,
          quantity: 1,
        });

        await expect(
          catalog.deleteRowsBySource('feed-b'),
        ).rejects.toMatchObject({
          code: 'SOURCE_IN_USE',
          details: { blocked: 'category_field' },
        });
      });

      it('names the option a Part of another source uses', async () => {
        const { category, viscosity } = await oilCategory();
        await catalog.createCategoryFieldOptions({
          field_id: viscosity.id,
          key: '10w-40',
          label: '10W-40',
          source: 'feed-c',
        });
        await part({
          category_id: category.id,
          attributes: { viscosity: '10w-40' },
        });

        await expect(
          catalog.deleteRowsBySource('feed-c'),
        ).rejects.toMatchObject({
          code: 'SOURCE_IN_USE',
          details: { blocked: 'category_field_option' },
        });
      });

      it('deletes a source larger than one chunk and leaves the others', async () => {
        const kept = await part();
        const ids = await Promise.all(
          Array.from({ length: 2101 }, () => part({ source: 'feed-d' })),
        );

        expect(await catalog.deleteRowsBySource('feed-d')).toBe(2 * ids.length);
        expect(await catalog.listParts({ source: 'feed-d' })).toHaveLength(0);
        expect(await catalog.listParts({ id: kept })).toHaveLength(1);
      });

      it('refuses a row another source starts to use while the deletion runs', async () => {
        const { model, engine } = await createVehicleFixture(catalog, {
          engineCode: 'RACE1',
          typeCode: 'RACE1',
        });
        const [vehicle] = await catalog.createVehicles([
          {
            model_id: model.id,
            engine_id: engine.id,
            power_kw: 77,
            source: 'feed-e',
          },
        ]);
        const manual = await part();

        const raced = await holdingLock(
          async (context) => {
            await (context.transactionManager as SqlEntityManager).execute(
              'select id from vehicle where id = ? for key share',
              [vehicle.id],
            );
            await catalog.createFitments(
              [{ part_id: manual, vehicle_id: vehicle.id }],
              context,
            );
          },
          () => catalog.deleteRowsBySource('feed-e'),
        );

        expect(raced.error).toMatchObject({
          code: 'SOURCE_IN_USE',
          details: {
            blocked: 'vehicle',
            holders: [{ source: 'manual', rows: 1 }],
          },
        });
        expect(await catalog.listFitments({ part_id: manual })).toHaveLength(1);
      });
    });

    describe('sweeping the Vehicles an import no longer lists', () => {
      const sourcedVehicle = async (code: string) => {
        const { model, engine } = await createVehicleFixture(catalog, {
          engineCode: code,
          typeCode: code,
        });
        const [vehicle] = await catalog.createVehicles([
          {
            model_id: model.id,
            engine_id: engine.id,
            power_kw: 90,
            source: 'feed-f',
          },
        ]);
        return vehicle.id;
      };

      it('deletes only the Vehicles nothing holds', async () => {
        const orphan = await sourcedVehicle('ORPH1');
        const fitted = await sourcedVehicle('ORPH2');
        const tombstoned = await sourcedVehicle('ORPH3');
        const manual = await part();
        await catalog.createFitments([{ part_id: manual, vehicle_id: fitted }]);
        const [tombstone] = await catalog.createFitments([
          { part_id: manual, vehicle_id: tombstoned },
        ]);
        await catalog.softDeleteFitments([tombstone.id]);

        await catalog.deleteOrphanVehicles(
          [orphan, fitted, tombstoned],
          'feed-f',
        );

        expect(
          (await catalog.listVehicles({ id: [orphan, fitted, tombstoned] }))
            .map(({ id }) => id)
            .sort(),
        ).toEqual([fitted, tombstoned].sort());
      });

      it('keeps a Vehicle staff fit a Part to while the sweep ran', async () => {
        const vehicle = await sourcedVehicle('ORPH4');
        const manual = await part();

        const raced = await holdingLock(
          async (context) => {
            await (context.transactionManager as SqlEntityManager).execute(
              'select id from vehicle where id = ? for key share',
              [vehicle],
            );
            await catalog.createFitments(
              [{ part_id: manual, vehicle_id: vehicle }],
              context,
            );
          },
          () => catalog.deleteOrphanVehicles([vehicle], 'feed-f'),
        );

        expect(raced.error).toBeUndefined();
        expect(await catalog.listVehicles({ id: vehicle })).toHaveLength(1);
        expect(
          await catalog.listFitments({ vehicle_id: vehicle }),
        ).toHaveLength(1);
      });
    });
  },
});
