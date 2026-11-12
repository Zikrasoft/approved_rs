import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import type { IRegionModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { createAdminAuth } from '../../../integration-tests/adminAuth';
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
  testSuite: ({ api, getContainer }) => {
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
          'start-stop',
          'polarity',
          'case-size',
          'length',
          'width',
          'height',
          'terminal-type',
          'terminal-layout',
        ]);
        expect(fields[0]).toMatchObject({
          type: 'number',
          label: 'Емкость',
          unit: 'А·ч',
          facet: true,
          required: true,
        });
        expect(fields.find(({ key }) => key === 'start-stop')).toMatchObject({
          type: 'boolean',
          label: 'Подходит для Start-Stop',
          facet: true,
          required: false,
        });
        expect(
          fields
            .filter(({ key }) =>
              ['polarity', 'case-size', 'length', 'width', 'height'].includes(
                key,
              ),
            )
            .map(({ facet }) => facet),
        ).toEqual([true, true, true, true, true]);
        const technology = fields.find(({ key }) => key === 'technology')!;
        const options = await catalog.listCategoryFieldOptions(
          { field_id: technology.id },
          { order: { rank: 'ASC' } },
        );
        expect(options.map(({ key, label }) => [key, label])).toEqual([
          ['standard', 'Обычный'],
          ['efb', 'EFB'],
          ['agm', 'AGM'],
          ['lithium', 'Литий-ионный'],
        ]);
      });

      it('gives the battery terminals a type and a layout to filter by, apart from polarity', async () => {
        const [batteries] = await catalog.listCategories({ slug: 'batteries' });
        const fields = await catalog.listCategoryFields(
          {
            category_id: batteries.id,
            key: ['terminal-type', 'terminal-layout'],
          },
          { relations: ['options'], order: { rank: 'ASC' } },
        );
        expect(
          fields.map(({ key, type, facet, options }) => ({
            key,
            type,
            facet,
            options: options.map((option) => option.key).sort(),
          })),
        ).toEqual([
          {
            key: 'terminal-type',
            type: 'single-select',
            facet: true,
            options: ['screw', 'standard', 'thin'],
          },
          {
            key: 'terminal-layout',
            type: 'single-select',
            facet: true,
            options: ['diagonal', 'long-side', 'short-side'],
          },
        ]);
      });

      const fieldsOf = async (slug: string) => {
        const [category] = await catalog.listCategories({ slug });
        return catalog.listCategoryFields(
          { category_id: category.id },
          { relations: ['options'], order: { rank: 'ASC' }, take: null },
        );
      };

      it('gives scheduled maintenance the engine oil and oil filter fields, every one optional and filterable', async () => {
        const fields = await fieldsOf('maintenance-consumables');
        expect(fields.map(({ key }) => key)).toEqual([
          'viscosity',
          'approvals',
          'volume',
          'base',
          'acea',
          'api',
          'filter-type',
          'height',
          'outer-diameter',
          'inner-diameter',
          'thread',
          'gasket-included',
          'bypass-valve',
          'length',
        ]);
        expect(fields.every(({ facet, required }) => facet && !required)).toBe(
          true,
        );
        const field = (key: string) => fields.find((f) => f.key === key)!;
        expect(
          field('base').options.map(({ key, label }) => [key, label]),
        ).toEqual(
          expect.arrayContaining([
            ['synthetic', 'Синтетическое'],
            ['semi-synthetic', 'Полусинтетическое'],
            ['mineral', 'Минеральное'],
          ]),
        );
        expect([field('acea').type, field('api').type]).toEqual([
          'multi-select',
          'multi-select',
        ]);
        expect(field('bypass-valve')).toMatchObject({
          type: 'boolean',
          label: 'Перепускной клапан',
        });
        expect(field('inner-diameter')).toMatchObject({
          type: 'number',
          unit: 'мм',
        });
      });

      it('gives the brake system the pad sizes, the brake system make and a disc diameter, every one optional', async () => {
        const fields = await fieldsOf('brakes');
        expect(fields.map(({ key }) => key)).toEqual([
          'axle',
          'thickness',
          'width',
          'height',
          'brake-system',
          'wear-sensor',
          'diameter',
        ]);
        expect(fields.every(({ facet, required }) => facet && !required)).toBe(
          true,
        );
        expect(
          fields
            .find(({ key }) => key === 'brake-system')!
            .options.map(({ label }) => label),
        ).toEqual([
          'ATE',
          'Bosch',
          'Lucas/TRW',
          'Akebono',
          'Brembo',
          'Sumitomo',
        ]);
      });

      it('leaves the categories it has no fields for with Brand alone', async () => {
        for (const slug of [
          'suspension',
          'engine-parts',
          'electrics',
          'transmission',
          'body-parts',
        ]) {
          expect(await fieldsOf(slug)).toEqual([]);
        }
      });

      it('seeds no Parts or offers', async () => {
        expect(await catalog.listParts()).toEqual([]);
        expect(await suppliers.listSupplierOffers()).toEqual([]);
      });

      it('registers each crawled site once as a Supplier with its import on and every staged kind released', async () => {
        const registered = await suppliers.listSuppliers();
        expect(registered.map(({ name }) => name).sort()).toEqual([
          'FILTRON',
          'MANN-FILTER',
          'VARTA',
          'bilstein group',
        ]);
        for (const supplier of registered) {
          expect(supplier).toMatchObject({
            import_enabled: true,
            released_kinds: ['cross_references', 'applicability', 'images'],
          });
        }
      });

      it('creates each crawled Brand once with the spelling its site prints', async () => {
        const supplierNames = new Map(
          (await suppliers.listSuppliers()).map(({ id, name }) => [id, name]),
        );
        const spellings = await catalog.listBrandSpellings(
          {},
          { relations: ['brand'], take: null },
        );
        expect(
          spellings
            .map(
              ({ supplier_id, value, brand }) =>
                `${supplierNames.get(supplier_id)}: ${value} -> ${brand.name}`,
            )
            .sort(),
        ).toEqual([
          'FILTRON: FILTRON -> FILTRON',
          'MANN-FILTER: MANN-FILTER -> MANN-FILTER',
          'VARTA: VARTA -> VARTA',
          'bilstein group: Blue Print -> Blue Print',
          'bilstein group: SWAG -> SWAG',
          'bilstein group: febi -> Febi',
        ]);
        expect(
          (await catalog.listBrands({}, { take: null }))
            .map(({ slug }) => slug)
            .sort(),
        ).toEqual([
          'blue-print',
          'febi',
          'filtron',
          'mann-filter',
          'swag',
          'varta',
        ]);
      });

      it('maps the VARTA battery category to «Аккумуляторы», the MANN-FILTER families to their Categories and excludes the industrial ones', async () => {
        const [varta] = await suppliers.listSuppliers({ name: 'VARTA' });
        const [mann] = await suppliers.listSuppliers({ name: 'MANN-FILTER' });
        const [batteries] = await catalog.listCategories({ slug: 'batteries' });
        const [maintenance] = await catalog.listCategories({
          slug: 'maintenance-consumables',
        });
        const [filtron] = await suppliers.listSuppliers({ name: 'FILTRON' });
        const [brakes] = await catalog.listCategories({ slug: 'brakes' });
        const [engine] = await catalog.listCategories({
          slug: 'engine-parts',
        });
        const [transmission] = await catalog.listCategories({
          slug: 'transmission',
        });
        const mappings = await suppliers.listSupplierCategories(
          {},
          { take: null },
        );
        const maintenanceCodes = [
          'Oil Filter',
          'Air Filter',
          'Fuel Filter | For diesel',
          'Fuel Filter | For gasoline',
          'Fuel Filter | Water Separator',
          'Cabin Air Filter | Particulate',
          'Cabin Air Filter | Activated carbon',
          'Cabin Air Filter | Biofunctional',
          'Secondary Element',
        ];
        const key = (row: { supplier_id: string; code: string }) =>
          `${row.supplier_id}:${row.code}`;
        expect(
          mappings
            .map(({ supplier_id, code, category_id }) => ({
              supplier_id,
              code,
              category_id,
            }))
            .sort((a, b) => key(a).localeCompare(key(b))),
        ).toEqual(
          [
            {
              supplier_id: varta.id,
              code: 'battery',
              category_id: batteries.id,
            },
            ...maintenanceCodes.map((code) => ({
              supplier_id: mann.id,
              code,
              category_id: maintenance.id,
            })),
            ...[
              'Filter vazduha',
              'Filter goriva',
              'Filter kabine',
              'Filter ulja',
              'Sekundarni element',
            ].map((code) => ({
              supplier_id: filtron.id,
              code,
              category_id: maintenance.id,
            })),
            { supplier_id: filtron.id, code: 'Sušač', category_id: brakes.id },
            {
              supplier_id: filtron.id,
              code: 'Filter hidrauličnog prenosa',
              category_id: transmission.id,
            },
            {
              supplier_id: mann.id,
              code: 'Ventilator',
              category_id: engine.id,
            },
            {
              supplier_id: mann.id,
              code: 'Hydraulic Transmission Filter',
              category_id: transmission.id,
            },
            ...[
              'Hydraulics',
              'Compressed Air-Oil Separation',
              'EDM Filter',
            ].map((code) => ({
              supplier_id: mann.id,
              code,
              category_id: null,
            })),
            { supplier_id: filtron.id, code: 'Hidraulika', category_id: null },
          ].sort((a, b) => key(a).localeCompare(key(b))),
        );
      });

      it('files each crawled spelling of one manufacturer under its one Make', async () => {
        const supplierNames = new Map(
          (await suppliers.listSuppliers()).map(({ id, name }) => [id, name]),
        );
        const makes = await catalog.listMakes(
          { slug: ['volkswagen', 'skoda', 'kia', 'ldv'] },
          { relations: ['spellings'], order: { slug: 'ASC' } },
        );
        const spelled = (slug: string, supplier: string) =>
          makes
            .find((make) => make.slug === slug)
            ?.spellings.filter(
              ({ supplier_id }) => supplierNames.get(supplier_id) === supplier,
            )
            .map(({ value }) => value)
            .sort();
        expect(makes.map(({ name }) => name)).toEqual([
          'Kia',
          'LDV',
          'Škoda',
          'Volkswagen',
        ]);
        expect(spelled('skoda', 'MANN-FILTER')).toEqual(['SKODA']);
        expect(spelled('kia', 'FILTRON')).toEqual(['KIA MOTORS']);
        expect(spelled('ldv', 'bilstein group')).toEqual([
          'LDV (Leyland-Daf Vans)',
          'LDV LIMITED',
        ]);
        expect(spelled('volkswagen', 'MANN-FILTER')).toEqual([
          'VW',
          'VW (VOLKSWAGEN)',
          'Volkswagen (VW)',
        ]);
        expect(await catalog.listMakes({ name: 'VOLVO CARS' })).toEqual([]);
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

      it('sells in dinars, not the euro Medusa starts the store with', async () => {
        const [store] = await getContainer()
          .resolve(Modules.STORE)
          .listStores({}, { relations: ['supported_currencies'] });
        expect(
          store.supported_currencies?.map(({ currency_code, is_default }) => [
            currency_code,
            is_default,
          ]),
        ).toEqual([['rsd', true]]);
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

      it('keeps an edited maintenance field and restores an untouched one', async () => {
        const fields = await fieldsOf('maintenance-consumables');
        const field = (key: string) => fields.find((f) => f.key === key)!;
        await catalog.updateCategoryFields([
          { id: field('acea').id, facet: false, updated_by: 'user_1' },
          { id: field('bypass-valve').id, label: 'Клапан' },
        ]);

        await run();

        expect(
          (await catalog.retrieveCategoryField(field('acea').id)).facet,
        ).toBe(false);
        expect(
          (await catalog.retrieveCategoryField(field('bypass-valve').id)).label,
        ).toBe('Перепускной клапан');
      });

      it('keeps a crawled Supplier, Brand, spelling, mapping or Make a person edited and restores the rest', async () => {
        const [varta, filtron, bilstein] = await Promise.all(
          ['VARTA', 'FILTRON', 'bilstein group'].map(
            async (name) => (await suppliers.listSuppliers({ name }))[0],
          ),
        );
        const [brakes] = await catalog.listCategories({ slug: 'brakes' });
        const [mapping] = await suppliers.listSupplierCategories({
          supplier_id: varta.id,
        });
        const [swag] = await catalog.listBrands({ slug: 'swag' });
        const [febi] = await catalog.listBrands({ slug: 'febi' });
        const [blueprintSpelling] = await catalog.listBrandSpellings({
          supplier_id: bilstein.id,
          value: 'Blue Print',
        });
        const [swagSpelling] = await catalog.listBrandSpellings({
          supplier_id: bilstein.id,
          value: 'SWAG',
        });
        const [volkswagen] = await catalog.listMakes({ slug: 'volkswagen' });
        await suppliers.updateSuppliers([
          {
            id: varta.id,
            released_kinds: ['images'],
            updated_by: 'user_1',
          },
          { id: filtron.id, released_kinds: [] },
        ]);
        await suppliers.updateSupplierCategories({
          id: mapping.id,
          category_id: brakes.id,
          updated_by: 'user_1',
        });
        await catalog.updateBrands([
          { id: swag.id, name: 'SWAG Autoteile', updated_by: 'user_1' },
          { id: febi.id, name: 'FEBI' },
        ]);
        await catalog.updateBrandSpellings([
          { id: blueprintSpelling.id, brand_id: febi.id, updated_by: 'user_1' },
          { id: swagSpelling.id, brand_id: febi.id },
        ]);
        await catalog.updateMakes({
          id: volkswagen.id,
          name: 'VW',
          updated_by: 'user_1',
        });

        await run();

        expect(
          (await suppliers.retrieveSupplier(varta.id)).released_kinds,
        ).toEqual(['images']);
        expect(
          (await suppliers.retrieveSupplier(filtron.id)).released_kinds,
        ).toEqual(['cross_references', 'applicability', 'images']);
        expect(
          (await suppliers.retrieveSupplierCategory(mapping.id)).category_id,
        ).toBe(brakes.id);
        expect((await catalog.retrieveBrand(swag.id)).name).toBe(
          'SWAG Autoteile',
        );
        expect((await catalog.retrieveBrand(febi.id)).name).toBe('Febi');
        expect(
          (await catalog.retrieveBrandSpelling(blueprintSpelling.id)).brand_id,
        ).toBe(febi.id);
        expect(
          (await catalog.retrieveBrandSpelling(swagSpelling.id)).brand_id,
        ).toBe(swag.id);
        expect((await catalog.retrieveMake(volkswagen.id)).name).toBe('VW');
        expect(await catalog.listMakes({ name: 'Volkswagen' })).toEqual([]);
      });

      it('finds a crawled Brand and Make again after staff renamed their slugs', async () => {
        const [filtron] = await catalog.listBrands({ slug: 'filtron' });
        const [volkswagen] = await catalog.listMakes({ slug: 'volkswagen' });
        const staff = { created_by: 'user_1', updated_by: 'user_1' };
        await catalog.renameSlug('brand', filtron.id, 'filtron-filters', staff);
        await catalog.renameSlug('make', volkswagen.id, 'vw-cars', staff);

        await run();

        expect(
          (await catalog.listBrands({}, { take: null })).filter(({ name }) =>
            name.startsWith('FILTRON'),
          ),
        ).toEqual([expect.objectContaining({ id: filtron.id })]);
        expect(
          await catalog.listMakes({ slug: ['volkswagen', 'vw-cars'] }),
        ).toEqual([
          expect.objectContaining({ id: volkswagen.id, slug: 'vw-cars' }),
        ]);
      });

      it('does not bring back a seeded spelling or mapping staff deleted', async () => {
        const adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@seed-production.local',
          'supersecret',
        );
        const [filtron, varta, mann] = await Promise.all(
          ['FILTRON', 'VARTA', 'MANN-FILTER'].map(
            async (name) => (await suppliers.listSuppliers({ name }))[0],
          ),
        );
        const [brandSpelling] = await catalog.listBrandSpellings({
          supplier_id: filtron.id,
        });
        const [makeSpelling] = await catalog.listMakeSpellings({
          supplier_id: mann.id,
          value: 'SKODA',
        });
        const [mapping] = await suppliers.listSupplierCategories({
          supplier_id: varta.id,
        });
        await api.delete(
          `/admin/brands/${brandSpelling.brand_id}/spellings/${brandSpelling.id}`,
          adminHeaders,
        );
        await api.delete(
          `/admin/makes/${makeSpelling.make_id}/spellings/${makeSpelling.id}`,
          adminHeaders,
        );
        await api.delete(
          `/admin/suppliers/${varta.id}/categories/${mapping.id}`,
          adminHeaders,
        );

        await run();

        expect(
          await catalog.listBrandSpellings({ supplier_id: filtron.id }),
        ).toEqual([]);
        expect(
          await catalog.listMakeSpellings({
            supplier_id: mann.id,
            value: 'SKODA',
          }),
        ).toEqual([]);
        expect(
          await suppliers.listSupplierCategories({ supplier_id: varta.id }),
        ).toEqual([]);
      });
    });
  },
});
