import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import { updateSupplierOfferWorkflow } from '../../../../workflows/update-supplier-offer';

type Facet = {
  key: string;
  values: { value: string; label: string; count: number }[];
};

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-search-universal-filters',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search universal filters', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      const part: Record<string, string> = {};
      let mahleOfferId: string;

      const search = (params: Record<string, string | string[]>) => {
        const query = new URLSearchParams({
          category: 'oil-filters',
          locale: 'ru',
        });
        for (const [key, value] of Object.entries(params)) {
          for (const item of [value].flat()) {
            query.append(key, item);
          }
        }
        return api
          .get(`/store/search?${query}`, storeHeaders)
          .catch((error) => error.response);
      };
      const partIds = (response: {
        data: { results: { part: { id: string } }[] };
      }) => response.data.results.map(({ part }) => part.id).sort();
      const facet = (response: { data: { facets: Facet[] } }, key: string) =>
        response.data.facets.find((candidate) => candidate.key === key);

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'universal-filter-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const brands = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Mahle', slug: 'mahle' },
          { name: 'Bosch', slug: 'bosch' },
          { name: 'Hengst', slug: 'hengst' },
        ]);
        const brand = Object.fromEntries(brands.map((b) => [b.slug, b.id]));
        const category = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const [filterType] = await catalog.createCategoryFields([
          {
            category_id: category.id,
            key: 'filter-type',
            type: 'single-select',
            label: 'Тип',
            facet: true,
            rank: 0,
          },
          {
            category_id: category.id,
            key: 'height',
            type: 'number',
            unit: 'мм',
            label: 'Высота',
            facet: true,
            rank: 1,
          },
        ]);
        await catalog.createCategoryFieldOptions([
          { field_id: filterType.id, key: 'cartridge', label: 'Элемент' },
        ]);
        const identifiers: Record<string, string> = {};
        for (const [slug, number, height] of [
          ['mann-filter', 'HU 1', 80],
          ['mahle', 'OX 1', 90],
          ['bosch', 'F 1', 100],
          ['hengst', 'H 1', 80],
        ] as const) {
          part[slug] = await catalog.createPartWithIdentifiers({
            name: `Масляный фильтр ${number}`,
            category_id: category.id,
            attributes: { 'filter-type': 'cartridge', height },
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: brand[slug],
                value: number,
              },
            ],
          });
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: part[slug],
          });
          identifiers[slug] = identifier.id;
        }
        const supplier = await suppliers.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        const offer = (
          slug: string,
          article: string,
          cost_price: number,
          stock_quantity: number,
        ) => ({
          supplier_id: supplier.id,
          supplier_article_id: article,
          part_identifier_id: identifiers[slug],
          cost_price,
          stock_quantity,
          lead_time_days: 1,
        });
        const offers = await suppliers.createSupplierOffers([
          offer('mann-filter', 'A-1', 1000, 5),
          offer('mahle', 'A-2', 2000, 0),
          offer('hengst', 'A-3', 1500, 2),
          offer('hengst', 'A-4', 500, 0),
        ]);
        mahleOfferId = offers[1].id;

        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      it('offers brand, availability and price beside the useful Category facets', async () => {
        const response = await search({});

        expect(response.data.count).toBe(4);
        expect(response.data.facets.map(({ key }: Facet) => key)).toEqual([
          'brand',
          'in-stock',
          'price',
          'height',
        ]);
        expect(facet(response, 'brand')).toMatchObject({
          type: 'single-select',
          values: [
            { value: 'bosch', label: 'Bosch', count: 1 },
            { value: 'hengst', label: 'Hengst', count: 1 },
            { value: 'mahle', label: 'Mahle', count: 1 },
            { value: 'mann-filter', label: 'Mann-Filter', count: 1 },
          ],
        });
        expect(facet(response, 'in-stock')).toMatchObject({
          type: 'boolean',
          values: [{ value: 'true', count: 2 }],
        });
        expect(facet(response, 'price')).toMatchObject({
          type: 'number',
          unit: 'RSD',
          values: [
            { value: '1200', count: 3 },
            { value: '2400', count: 3 },
          ],
        });
      });

      it('narrows to any of the chosen brands and keeps counting the others', async () => {
        const response = await search({
          facets: ['brand:mann-filter', 'brand:mahle'],
        });

        expect(partIds(response)).toEqual(
          [part['mann-filter'], part.mahle].sort(),
        );
        expect(
          facet(response, 'brand')?.values.map(({ count }) => count),
        ).toEqual([1, 1, 1, 1]);
        expect(facet(response, 'in-stock')?.values).toEqual([
          { value: 'true', label: 'true', count: 1 },
        ]);
      });

      it('keeps only Parts with an in-stock offer', async () => {
        const response = await search({ facets: 'in-stock:true' });

        expect(partIds(response)).toEqual(
          [part['mann-filter'], part.hengst].sort(),
        );
        expect(response.data.count).toBe(2);
        expect(facet(response, 'brand')?.values).toEqual([
          { value: 'bosch', label: 'Bosch', count: 0 },
          { value: 'hengst', label: 'Hengst', count: 1 },
          { value: 'mahle', label: 'Mahle', count: 0 },
          { value: 'mann-filter', label: 'Mann-Filter', count: 1 },
        ]);
      });

      it('filters on the best offer price and bounds it without its own range', async () => {
        const response = await search({ range: 'price:1500:' });

        expect(partIds(response)).toEqual([part.mahle, part.hengst].sort());
        expect(facet(response, 'price')?.values).toEqual([
          { value: '1200', label: '1200', count: 3 },
          { value: '2400', label: '2400', count: 3 },
        ]);
      });

      it('combines brand, availability and price, and pages the result', async () => {
        const response = await search({
          facets: ['brand:mann-filter', 'brand:hengst', 'in-stock:true'],
          range: 'price::2000',
          limit: '1',
        });

        expect(response.data.count).toBe(2);
        expect(response.data.results).toHaveLength(1);
      });

      it('hides a facet every result shares, unless it is chosen', async () => {
        const single = await search({ q: 'HU 1' });
        const chosen = await search({
          q: 'HU 1',
          facets: 'brand:mann-filter',
        });

        expect(single.data.count).toBe(1);
        expect(single.data.facets).toEqual([]);
        expect(chosen.data.facets.map(({ key }: Facet) => key)).toEqual([
          'brand',
        ]);
      });

      it('refuses a malformed price range', async () => {
        const response = await search({ range: 'price:abc:' });

        expect(response.status).toBe(400);
      });

      it('reindexes a Part when its offer changes', async () => {
        await updateSupplierOfferWorkflow(getContainer()).run({
          input: { id: mahleOfferId, stock_quantity: 3 },
        });

        let count = 0;
        for (let attempt = 0; attempt < 20 && count !== 3; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          count = facet(await search({}), 'in-stock')?.values[0].count ?? 0;
        }
        expect(count).toBe(3);
      });
    });
  },
});
