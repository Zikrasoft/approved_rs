import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

type Response = {
  status: number;
  data: {
    count: number;
    offset: number;
    results: { id: string; part: { id: string } }[];
    facets: { key: string; values: { value: string; count: number }[] }[];
  };
};

const TAGS = Array.from({ length: 600 }, (_, at) => `t${at}`);

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-search-browse-filters',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search browsing a Category with filters', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      const part: Record<string, string> = {};
      const number: Record<string, string> = {};

      const search = (
        params: Record<string, string | string[]>,
      ): Promise<Response> => {
        const query = new URLSearchParams({ locale: 'ru' });
        for (const [key, value] of Object.entries({
          category: 'batteries',
          ...params,
        })) {
          for (const item of [value].flat()) {
            query.append(key, item);
          }
        }
        return api
          .get(`/store/search?${query}`, storeHeaders)
          .catch((error) => error.response);
      };
      const partIds = ({ data }: Response) =>
        data.results.map(({ part }) => part.id).sort();
      const facetKeys = ({ data }: Response) =>
        data.facets.map(({ key }) => key);
      const closedShop = async <T>(run: () => Promise<T>): Promise<T> => {
        process.env.SHOP_OPEN = 'false';
        try {
          return await run();
        } finally {
          delete process.env.SHOP_OPEN;
        }
      };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'browse-filter-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [varta] = await catalog.createBrands([
          { name: 'Varta', slug: 'varta' },
        ]);
        const batteries = await catalog.createCategories({
          slug: 'batteries',
          name: 'Аккумуляторы',
        });
        const pads = await catalog.createCategories({
          slug: 'brake-pads',
          name: 'Тормозные колодки',
        });
        const fields = await catalog.createCategoryFields([
          {
            category_id: batteries.id,
            key: 'capacity',
            type: 'number',
            label: 'Емкость',
            facet: true,
            rank: 0,
          },
          {
            category_id: batteries.id,
            key: 'length',
            type: 'number',
            label: 'Длина',
            facet: true,
            rank: 1,
          },
          {
            category_id: batteries.id,
            key: 'tags',
            type: 'multi-select',
            label: 'Метки',
            facet: true,
            rank: 2,
          },
          {
            category_id: pads.id,
            key: 'thickness',
            type: 'number',
            label: 'Толщина',
            facet: true,
            rank: 0,
          },
        ]);
        await catalog.createCategoryFieldOptions(
          TAGS.map((tag) => ({ field_id: fields[2].id, key: tag, label: tag })),
        );
        const battery = async (
          name: string,
          values: string[],
          attributes: Record<string, unknown>,
        ) => {
          part[name] = await catalog.createPartWithIdentifiers({
            name: `Аккумулятор ${name}`,
            category_id: batteries.id,
            attributes,
            identifiers: values.map((value) => ({
              type: 'manufacturer-number' as const,
              brand_id: varta.id,
              value,
            })),
          });
          for (const identifier of await catalog.listPartIdentifiers({
            part_id: part[name],
          })) {
            number[identifier.value] = identifier.id;
          }
        };
        await battery('a', ['VA 60'], {
          capacity: 60,
          length: 242,
          tags: TAGS,
        });
        await battery('b', ['VB 77'], {
          capacity: 77,
          length: 278,
          tags: TAGS,
        });
        await battery('c', ['VC 95'], { capacity: 95, length: 353.6 });
        await battery('d', ['VD OLD', 'VD NEW'], { capacity: 70, length: 278 });
        await battery('e', ['VE 1'], { capacity: 72, length: 278 });
        await battery('f', ['VF 1'], { capacity: 50, length: 278 });
        await battery('g', ['VG OLD'], { capacity: 45, length: 278 });
        await catalog.updatePartIdentifiers([
          { id: number['VD OLD'], superseded: true },
          { id: number['VG OLD'], superseded: true },
        ]);
        await catalog.replacePart(part.e, part.f, null);

        const supplier = await suppliers.createSuppliers({
          key: 'demo-intercars',
          name: 'Intercars',
          markup_percentage: 0,
        });
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'A-1',
          part_identifier_id: number['VA 60'],
          cost_price: 1000,
          stock_quantity: 4,
          lead_time_days: 1,
        });

        await getContainer()
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      it('lists only current numbers when browsing, as the Category page does', async () => {
        const response = await search({});

        expect(response.data.count).toBe(6);
        expect(response.data.results.map(({ id }) => id).sort()).toEqual(
          ['VA 60', 'VB 77', 'VC 95', 'VD NEW', 'VF 1', 'VG OLD']
            .map((value) => number[value])
            .sort(),
        );
      });

      it('still finds a superseded or replaced number by its text', async () => {
        const superseded = await search({ q: 'VD OLD' });
        const replaced = await search({ q: 'VE 1' });

        expect(superseded.data.results.map(({ id }) => id)).toContain(
          number['VD OLD'],
        );
        expect(replaced.data.results.map(({ id }) => id)).toContain(
          number['VE 1'],
        );
      });

      it('filters a range on values beyond the facet count limit', async () => {
        const response = await search({ range: 'capacity:70:80' });

        expect(partIds(response)).toEqual([part.b, part.d].sort());
        expect(response.data.count).toBe(2);
      });

      it('keeps a decimal bound inclusive', async () => {
        const response = await search({ range: 'length:353.6:' });

        expect(partIds(response)).toEqual([part.c]);
      });

      it('reads an exponent, a tiny decimal and swapped bounds instead of refusing them', async () => {
        const huge = await search({ range: 'capacity:1e21:' });
        const ceiling = await search({ range: 'capacity::1e21' });
        const tiny = await search({ range: 'capacity:0.0000001:' });
        const swapped = await search({ range: 'capacity:95:60' });

        expect(huge.status).toBe(200);
        expect(huge.data.count).toBe(0);
        expect(ceiling.data.count).toBe(6);
        expect(tiny.data.count).toBe(6);
        expect(partIds(swapped)).toEqual(
          [part.a, part.b, part.c, part.d].sort(),
        );
      });

      it('answers an offset past the last page with an empty page and the total', async () => {
        const response = await search({ offset: '20000' });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          results: [],
          count: 6,
          offset: 10_000,
        });
      });

      it('ignores a range or facet key the Category does not have', async () => {
        const plain = await search({});
        const otherCategoryRange = await search({ range: 'thickness:1:' });
        const unknownRange = await search({ range: 'nosuch:1:' });
        const otherCategoryFacet = await search({ facets: 'thickness:10' });

        for (const response of [
          otherCategoryRange,
          unknownRange,
          otherCategoryFacet,
        ]) {
          expect(response.status).toBe(200);
          expect(response.data).toEqual(plain.data);
        }
      });

      it('hides a facet whose every value matches every result', async () => {
        const response = await search({ q: 'VB 77' });
        const chosen = await search({ q: 'VB 77', facets: 'tags:t1' });

        expect(response.data.count).toBe(1);
        expect(facetKeys(response)).not.toContain('tags');
        expect(facetKeys(chosen)).toContain('tags');
      });

      it('narrows on stock while the shop is open', async () => {
        const response = await search({ facets: 'in-stock:true' });

        expect(partIds(response)).toEqual([part.a]);
      });

      it('counts stock even when attribute values exceed the facet value limit', async () => {
        const response = await search({});

        expect(
          response.data.facets.find(({ key }) => key === 'in-stock')?.values,
        ).toEqual([{ value: 'true', label: 'true', count: 1 }]);
      });

      it('ignores stock and price filters and counts no stock while the shop is closed', async () => {
        const [plain, inStock, outOfStock, priced] = await closedShop(() =>
          Promise.all([
            search({}),
            search({ facets: 'in-stock:true' }),
            search({ facets: 'in-stock:false' }),
            search({ range: 'price:99999:' }),
          ]),
        );

        expect(facetKeys(plain)).not.toContain('in-stock');
        for (const response of [inStock, outOfStock, priced]) {
          expect(response.data).toEqual(plain.data);
        }
      });
    });
  },
});
