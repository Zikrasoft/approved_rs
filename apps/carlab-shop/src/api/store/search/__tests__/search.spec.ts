import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

type Result = {
  value: string;
  superseded: boolean;
  thumbnail: string | null;
  brand: { slug: string };
  part: { id: string; name: string; category: { name: string } | null };
};

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-search-typesense-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let oilFilterId: string;
      let airFilterId: string;
      let thinOilId: string;
      let thickOilId: string;
      let batteryIds: Record<number, string>;

      const search = (params: Record<string, string | string[]>) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          for (const item of [value].flat()) {
            query.append(key, item);
          }
        }
        return api
          .get(`/store/search?${query}`, storeHeaders)
          .catch((error) => error.response);
      };

      const results = async (
        params: Record<string, string | string[]>,
      ): Promise<Result[]> => (await search(params)).data.results;

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );

        const key = await apiKeys.createApiKeys({
          title: 'search-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [bmw, mann, castrol] = await catalog.createBrands([
          { name: 'BMW', slug: 'bmw' },
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Castrol', slug: 'castrol' },
        ]);

        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
          translations: {
            sr: { name: 'Filteri za ulje' },
            en: { name: 'Oil filters' },
          },
        });
        const engineOil = await catalog.createCategories({
          slug: 'engine-oil',
          name: 'Моторное масло',
          translations: {
            sr: { name: 'Motorno ulje' },
            en: { name: 'Engine oil' },
          },
        });
        const [viscosity] = await catalog.createCategoryFields([
          {
            category_id: engineOil.id,
            key: 'viscosity',
            type: 'single-select',
            label: 'Вязкость',
            translations: { sr: { label: 'Viskozitet' } },
            rank: 1,
            facet: true,
          },
          {
            category_id: engineOil.id,
            key: 'volume',
            type: 'number',
            unit: 'l',
            label: 'Объем',
            rank: 2,
          },
        ]);
        await catalog.createCategoryFieldOptions([
          { field_id: viscosity.id, key: '0w-20', label: '0W-20', rank: 1 },
          { field_id: viscosity.id, key: '5w-30', label: '5W-30', rank: 2 },
        ]);

        oilFilterId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: oilFilters.id,
          identifiers: [
            { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });
        airFilterId = await catalog.createPartWithIdentifiers({
          name: 'Воздушный фильтр',
          identifiers: [
            { type: 'oem', brand_id: bmw.id, value: '13 71 8511877' },
          ],
        });
        thinOilId = await catalog.createPartWithIdentifiers({
          name: 'Масло Castrol Edge',
          category_id: engineOil.id,
          attributes: { viscosity: '0w-20', volume: 5 },
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: castrol.id,
              value: '15F6E3',
            },
          ],
        });
        thickOilId = await catalog.createPartWithIdentifiers({
          name: 'Масло Castrol Magnatec',
          category_id: engineOil.id,
          attributes: { viscosity: '5w-30', volume: 4 },
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: castrol.id,
              value: '15C94E',
            },
          ],
        });
        const batteries = await catalog.createCategories({
          slug: 'batteries',
          name: 'Аккумуляторы',
          translations: { en: { name: 'Batteries' } },
        });
        await catalog.createCategoryFields([
          {
            category_id: batteries.id,
            key: 'capacity',
            type: 'number',
            unit: 'Ah',
            label: 'Емкость',
            rank: 1,
            facet: true,
          },
          {
            category_id: batteries.id,
            key: 'voltage',
            type: 'number',
            unit: 'V',
            label: 'Напряжение',
            rank: 2,
            facet: true,
          },
        ]);
        batteryIds = {};
        for (const capacity of [100, 60, 80]) {
          batteryIds[capacity] = await catalog.createPartWithIdentifiers({
            name: `Аккумулятор ${capacity}`,
            category_id: batteries.id,
            attributes: { capacity, voltage: capacity === 100 ? 24 : 12 },
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: mann.id,
                value: `BAT ${capacity}`,
              },
            ],
          });
        }

        await catalog.updateParts([
          {
            id: oilFilterId,
            translations: {
              sr: { name: 'Filter ulja' },
              en: { name: 'Oil filter' },
            },
          },
          {
            id: airFilterId,
            translations: {
              sr: { name: 'Prečistač vazduha' },
              en: { name: 'Filter' },
            },
          },
        ]);

        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      it('gives each result a thumbnail: its Part photo, else its Category photo', async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const image = (name: string) => ({
          id: name,
          src: `http://localhost/static/${name}-480.webp`,
          width: 480,
          height: 480,
          srcset: [
            { url: `http://localhost/static/${name}-160.webp`, width: 160 },
            { url: `http://localhost/static/${name}-480.webp`, width: 480 },
          ],
          file_ids: [`${name}-160.webp`, `${name}-480.webp`],
          source: 'manual',
          created_by: null,
        });
        await catalog.updateParts({
          id: thinOilId,
          images: { items: [image('edge')] },
        });
        const [engineOil] = await catalog.listCategories({
          slug: 'engine-oil',
        });
        await catalog.updateCategories({
          id: engineOil.id,
          image: image('oil'),
        });

        const thumbnails = Object.fromEntries(
          [
            ...(await results({ category: 'engine-oil', locale: 'ru' })),
            ...(await results({ q: '13718511877', locale: 'ru' })),
          ].map(({ value, thumbnail }) => [value, thumbnail]),
        );

        expect(thumbnails).toEqual({
          '15F6E3': 'http://localhost/static/edge-160.webp',
          '15C94E': 'http://localhost/static/oil-160.webp',
          '13 71 8511877': null,
        });
      });

      it('ranks a match in the page locale first', async () => {
        const [serbian] = await results({ q: 'filter', locale: 'sr' });
        const [english] = await results({ q: 'filter', locale: 'en' });

        expect(serbian.part).toMatchObject({
          id: oilFilterId,
          name: 'Filter ulja',
          category: { name: 'Filteri za ulje' },
        });
        expect(english.part).toMatchObject({ id: airFilterId, name: 'Filter' });
      });

      it('still finds a Russian query on a Serbian page', async () => {
        const found = await results({ q: 'масляный фильтр', locale: 'sr' });

        expect(found[0].part.id).toBe(oilFilterId);
      });

      it('matches Cyrillic input to Latin Serbian names', async () => {
        const [first] = await results({ q: 'Филтер уља', locale: 'sr' });
        const [cleaner] = await results({ q: 'пречистач', locale: 'sr' });

        expect(first.part.id).toBe(oilFilterId);
        expect(cleaner.part).toMatchObject({
          id: airFilterId,
          name: 'Prečistač vazduha',
        });
      });

      it('returns every brand-number of a Part as a list, the typed one first', async () => {
        const found = await results({ q: '11 42 8575211', locale: 'ru' });

        expect(
          found.map(({ brand, value }) => `${brand.slug} ${value}`),
        ).toEqual(['bmw 11 42 8575211', 'mann-filter HU 816 x']);
      });

      it('finds a number typed without spaces or with punctuation', async () => {
        const [compact] = await results({ q: 'hu816x', locale: 'ru' });
        const [dotted] = await results({ q: '11.42.8575211', locale: 'ru' });

        expect(compact.value).toBe('HU 816 x');
        expect(dotted.value).toBe('11 42 8575211');
      });

      it('builds facets from the Category field definitions', async () => {
        const response = await search({ q: 'castrol', locale: 'sr' });

        expect(response.data.facets).toEqual([
          {
            key: 'viscosity',
            type: 'single-select',
            label: 'Viskozitet',
            unit: null,
            values: [
              { value: '0w-20', label: '0W-20', count: 1 },
              { value: '5w-30', label: '5W-30', count: 1 },
            ],
          },
        ]);
      });

      it('filters by a facet value', async () => {
        const found = await results({
          q: 'castrol',
          locale: 'ru',
          facets: 'viscosity:5w-30',
        });

        expect(found.map(({ part }) => part.id)).toEqual([thickOilId]);
        expect(found.map(({ part }) => part.id)).not.toContain(thinOilId);
      });

      it('lists a whole Category without a query', async () => {
        const response = await search({ category: 'engine-oil', locale: 'en' });

        expect(response.status).toBe(200);
        expect(response.data.count).toBe(2);
        expect(
          response.data.results.map(({ part }: Result) => part.id).sort(),
        ).toEqual([thinOilId, thickOilId].sort());
        expect(response.data.category).toEqual({
          slug: 'engine-oil',
          name: 'Engine oil',
        });
        expect(
          response.data.facets.map(({ key }: { key: string }) => key),
        ).toEqual(['viscosity']);
      });

      it('narrows a Category to a range of numbers, listed in numeric order', async () => {
        const all = await search({ category: 'batteries', locale: 'ru' });
        const large = await results({
          category: 'batteries',
          locale: 'ru',
          facets: ['capacity:80', 'capacity:100'],
        });

        expect(all.data.facets).toEqual([
          {
            key: 'capacity',
            type: 'number',
            label: 'Емкость',
            unit: 'Ah',
            values: [
              { value: '60', label: '60', count: 1 },
              { value: '80', label: '80', count: 1 },
              { value: '100', label: '100', count: 1 },
            ],
          },
          {
            key: 'voltage',
            type: 'number',
            label: 'Напряжение',
            unit: 'V',
            values: [
              { value: '12', label: '12', count: 2 },
              { value: '24', label: '24', count: 1 },
            ],
          },
        ]);
        expect(large.map(({ part }) => part.id).sort()).toEqual(
          [batteryIds[80], batteryIds[100]].sort(),
        );
      });

      it('counts each facet with every other chosen facet applied but not its own', async () => {
        const response = await search({
          category: 'batteries',
          locale: 'ru',
          facets: ['capacity:60', 'voltage:12'],
        });

        expect(response.data.facets).toEqual([
          expect.objectContaining({
            key: 'capacity',
            values: [
              { value: '60', label: '60', count: 1 },
              { value: '80', label: '80', count: 1 },
              { value: '100', label: '100', count: 0 },
            ],
          }),
          expect.objectContaining({
            key: 'voltage',
            values: [
              { value: '12', label: '12', count: 1 },
              { value: '24', label: '24', count: 0 },
            ],
          }),
        ]);
      });

      it('narrows a number field to a range and counts it without its own range', async () => {
        const response = await search({
          category: 'batteries',
          locale: 'ru',
          range: 'capacity:70:',
        });
        const below = await results({
          category: 'batteries',
          locale: 'ru',
          range: ['capacity::80', 'voltage:24:'],
        });
        const outside = await search({
          category: 'batteries',
          locale: 'ru',
          range: 'capacity:200:300',
        });

        expect(
          response.data.results.map(({ part }: Result) => part.id).sort(),
        ).toEqual([batteryIds[80], batteryIds[100]].sort());
        expect(response.data.facets[0]).toMatchObject({
          key: 'capacity',
          type: 'number',
          values: [
            { value: '60', count: 1 },
            { value: '80', count: 1 },
            { value: '100', count: 1 },
          ],
        });
        expect(response.data.facets[1].values).toEqual([
          { value: '12', label: '12', count: 1 },
          { value: '24', label: '24', count: 1 },
        ]);
        expect(below).toEqual([]);
        expect(outside.status).toBe(200);
        expect(outside.data.count).toBe(0);
      });

      it.each(['capacity::', 'capacity:abc:', 'capacity:95:60'])(
        'refuses the malformed range %j',
        async (range) => {
          const response = await search({
            category: 'batteries',
            locale: 'ru',
            range,
          });

          expect(response.status).toBe(400);
        },
      );

      it('keeps describing chosen values that leave nothing to list', async () => {
        const response = await search({
          category: 'engine-oil',
          locale: 'ru',
          facets: ['viscosity:0w-20', 'viscosity:5w-30', 'viscosity:10w-60'],
          q: 'magnatec',
        });

        expect(response.data.results).toHaveLength(1);
        expect(response.data.facets).toEqual([
          {
            key: 'viscosity',
            type: 'single-select',
            label: 'Вязкость',
            unit: null,
            values: [
              { value: '10w-60', label: '10w-60', count: 0 },
              { value: '0w-20', label: '0W-20', count: 0 },
              { value: '5w-30', label: '5W-30', count: 1 },
            ],
          },
        ]);
      });

      it('searches by text inside a Category', async () => {
        const found = await results({
          q: 'castrol',
          category: 'oil-filters',
          locale: 'ru',
        });

        expect(found).toEqual([]);
      });

      it('answers 404 for an unknown Category and 400 for a malformed one', async () => {
        const unknown = await search({ category: 'no-such', locale: 'ru' });
        const malformed = await search({ category: 'Bad Slug', locale: 'ru' });

        expect(unknown.status).toBe(404);
        expect(malformed.status).toBe(400);
      });

      it('returns an empty list for a query nothing matches', async () => {
        const response = await search({
          q: 'does-not-exist-9999',
          locale: 'ru',
        });

        expect(response.status).toBe(200);
        expect(response.data.results).toEqual([]);
      });

      it('finds nothing for a query of symbols only', async () => {
        const response = await search({ q: '%', locale: 'ru' });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({ results: [], count: 0 });
      });

      it('refuses a request without a query or with an unknown locale', async () => {
        const withoutQuery = await search({ locale: 'ru' });
        const unknownLocale = await search({ q: 'filter', locale: 'de' });
        const withoutLocale = await search({ q: 'filter' });

        expect(withoutQuery.status).toBe(400);
        expect(unknownLocale.status).toBe(400);
        expect(withoutLocale.status).toBe(400);
      });

      it('finds a superseded number and marks it', async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const [bmw] = await catalog.listBrands({ slug: 'bmw' });
        const oldPartId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр, старый номер',
          identifiers: [
            { type: 'oem', brand_id: bmw.id, value: '11 42 7953125' },
          ],
        });
        const [identifier] = await catalog.listPartIdentifiers({
          part_id: oldPartId,
        });
        await catalog.updatePartIdentifiers({
          id: identifier.id,
          superseded: true,
        });
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });

        const [found] = await results({ q: '11 42 7953125', locale: 'ru' });

        expect(found).toMatchObject({
          superseded: true,
          part: { id: oldPartId },
        });
      });

      it('builds a new collection on reindex and swaps reads to it', async () => {
        const collections = async () => {
          const response = await fetch(
            `http://localhost:${process.env.TYPESENSE_PORT}/collections`,
            { headers: { 'X-TYPESENSE-API-KEY': 'xyz' } },
          );
          return (
            (await response.json()) as {
              name: string;
              created_at: number;
            }[]
          ).filter(({ name }) => name.startsWith('part_identifier_v'));
        };
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        await catalog.createPartWithIdentifiers({
          name: 'Салонный фильтр',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'CUK 2939',
            },
          ],
        });
        const before = await results({ q: 'CUK 2939', locale: 'ru' });
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const startedAt = Math.floor(Date.now() / 1000);

        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });

        const built = (await collections()).filter(
          ({ created_at }) => created_at >= startedAt,
        );
        const [found] = await results({ q: 'CUK 2939', locale: 'ru' });
        expect(before).toEqual([]);
        expect(built).toHaveLength(1);
        expect(found.value).toBe('CUK 2939');
      });
    });
  },
});
