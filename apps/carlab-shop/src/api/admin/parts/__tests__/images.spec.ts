import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import sharp from 'sharp';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { MAX_IMAGE_BYTES } from '../../../../lib/images';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const ADMIN_EMAIL = 'admin@images-tests.local';
const ADMIN_PASSWORD = 'supersecret';

const picture = (width: number, height: number, format: 'png' | 'jpeg') =>
  sharp({
    create: { width, height, channels: 3, background: '#7a8899' },
  })
    [format]()
    .toBuffer();

type StoredImage = {
  id: string;
  src: string;
  width: number;
  height: number;
  srcset: { url: string; width: number }[];
  source: string;
  created_by: string | null;
};

medusaIntegrationTestRunner({
  moduleName: 'images',
  testSuite: ({ api, getContainer }) => {
    describe('Part and Category images', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let partId: string;
      let categoryId: string;

      const upload = (path: string, body: Buffer, type = 'image/png') =>
        api
          .post(path, body, {
            headers: {
              ...adminHeaders.headers,
              'content-type': type,
            },
          })
          .catch((error) => error.response);

      const staticFile = (url: string) =>
        api
          .get(new URL(url).pathname, { responseType: 'arraybuffer' })
          .catch((error) => error.response);

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'images-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
        const mann = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const category = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        categoryId = category.id;
        partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: categoryId,
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });
      });

      const partImages = async (): Promise<StoredImage[]> => {
        const response = await api.get('/admin/parts?q=HU816X', adminHeaders);
        return response.data.parts[0].images;
      };

      it('stores an uploaded photo as resized webp files served from /static', async () => {
        const response = await upload(
          `/admin/parts/${partId}/images`,
          await picture(1200, 900, 'png'),
        );

        expect(response.status).toBe(200);
        const [image] = response.data.images;
        expect(image).toEqual({
          id: expect.any(String),
          src: expect.stringMatching(/\.webp$/),
          width: 960,
          height: 720,
          srcset: [
            { url: expect.stringMatching(/\.webp$/), width: 160 },
            { url: expect.stringMatching(/\.webp$/), width: 480 },
            { url: image.src, width: 960 },
          ],
          source: 'manual',
          created_by: expect.any(String),
        });
        expect(image).not.toHaveProperty('file_ids');
        const served = await staticFile(image.srcset[0].url);
        expect(served.status).toBe(200);
        expect(
          (await sharp(Buffer.from(served.data)).metadata()).width,
        ).toBeLessThanOrEqual(160);
        expect(await partImages()).toEqual(response.data.images);
      });

      const uploadTwo = async (): Promise<StoredImage[]> => {
        await upload(
          `/admin/parts/${partId}/images`,
          await picture(1200, 900, 'png'),
        );
        const response = await upload(
          `/admin/parts/${partId}/images`,
          await picture(300, 300, 'jpeg'),
          'image/jpeg',
        );
        return response.data.images;
      };

      it('appends photos and never enlarges a small one', async () => {
        const [first, added] = await uploadTwo();

        expect(first.width).toBe(960);
        expect(added.width).toBe(300);
        expect(added.srcset.map(({ width }) => width)).toEqual([160, 300]);
      });

      it.each([
        ['a type that is not an image', Buffer.from('hello'), 'text/plain'],
        ['a gif', Buffer.from('GIF89a'), 'image/gif'],
        [
          'bytes that are not the image they claim',
          Buffer.from('nope'),
          'image/png',
        ],
      ])('refuses %s', async (_, body, type) => {
        const response = await upload(
          `/admin/parts/${partId}/images`,
          body,
          type,
        );

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('INVALID_IMAGE');
        expect(await partImages()).toEqual([]);
      });

      it('refuses a file over the size limit', async () => {
        const response = await upload(
          `/admin/parts/${partId}/images`,
          Buffer.alloc(MAX_IMAGE_BYTES + 1),
        );

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('IMAGE_TOO_LARGE');
      });

      it('reorders the photos', async () => {
        const [first, second] = await uploadTwo();

        const response = await api.post(
          `/admin/parts/${partId}/images/order`,
          { ids: [second.id, first.id] },
          adminHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.images).toEqual([second, first]);
        expect(await partImages()).toEqual([second, first]);
      });

      it('refuses an order that does not list every photo once', async () => {
        const [first] = await uploadTwo();

        const response = await api
          .post(
            `/admin/parts/${partId}/images/order`,
            { ids: [first.id, first.id] },
            adminHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('INVALID_FIELD');
      });

      it('shows the photos on the store part page in order, without stored files or provenance', async () => {
        const [first, second] = await uploadTwo();

        const response = await api.get('/store/part-pages', storeHeaders);

        expect(response.data.pages[0].part.images).toEqual(
          [first, second].map(({ src, width, height, srcset }) => ({
            src,
            width,
            height,
            srcset,
          })),
        );
      });

      it('deletes a photo and its files', async () => {
        const [first, second] = await uploadTwo();

        const response = await api.delete(
          `/admin/parts/${partId}/images/${first.id}`,
          adminHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.images).toEqual([second]);
        for (const { url } of first.srcset) {
          expect((await staticFile(url)).status).toBe(404);
        }
        expect((await staticFile(second.src)).status).toBe(200);
      });

      it('answers 404 for a photo the Part does not have', async () => {
        const response = await api
          .delete(`/admin/parts/${partId}/images/missing`, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(404);
      });

      it('sets, replaces and removes the Category image', async () => {
        const first = await upload(
          `/admin/categories/${categoryId}/image`,
          await picture(800, 800, 'png'),
        );
        expect(first.status).toBe(200);
        expect(first.data.image).toEqual(
          expect.objectContaining({ width: 800, height: 800 }),
        );

        const second = await upload(
          `/admin/categories/${categoryId}/image`,
          await picture(640, 480, 'jpeg'),
          'image/jpeg',
        );
        expect(second.data.image.width).toBe(640);
        expect((await staticFile(first.data.image.src)).status).toBe(404);

        const store = await api.get('/store/categories', storeHeaders);
        expect(store.data.categories[0].image).toEqual({
          src: second.data.image.src,
          width: 640,
          height: 480,
          srcset: second.data.image.srcset,
        });

        const removed = await api.delete(
          `/admin/categories/${categoryId}/image`,
          adminHeaders,
        );
        expect(removed.data.image).toBeNull();
        expect((await staticFile(second.data.image.src)).status).toBe(404);
      });
    });
  },
});
