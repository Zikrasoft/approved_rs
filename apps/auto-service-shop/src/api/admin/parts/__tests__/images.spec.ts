import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import sharp from 'sharp';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { MAX_IMAGE_BYTES } from '../../../../lib/images';
import { publishAllNumbers } from '../../../../lib/publish/published';
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
    describe('Brand-number and Category images', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let mannId: string;
      let bmwId: string;
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
        const bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          category_id: categoryId,
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
            { type: 'oem', brand_id: bmw.id, value: '11 42 8575211' },
          ],
        });
        const identifiers = await catalog.listPartIdentifiers({
          part_id: partId,
        });
        const idOf = (normalized: string) =>
          identifiers.find(
            ({ normalized_value }) => normalized_value === normalized,
          )!.id;
        mannId = idOf('HU816X');
        bmwId = idOf('11428575211');
      });

      const imagesPath = (identifierId = mannId) =>
        `/admin/part-identifiers/${identifierId}/images`;

      const identifierImages = async (
        identifierId = mannId,
      ): Promise<StoredImage[]> => {
        const response = await api.get('/admin/parts?q=HU816X', adminHeaders);
        return response.data.parts[0].identifiers.find(
          ({ id }: { id: string }) => id === identifierId,
        ).images;
      };

      it('stores an uploaded photo as resized webp files served from /static', async () => {
        const response = await upload(
          imagesPath(),
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
        expect(await identifierImages()).toEqual(response.data.images);
      });

      const uploadTwo = async (): Promise<StoredImage[]> => {
        await upload(imagesPath(), await picture(1200, 900, 'png'));
        const response = await upload(
          imagesPath(),
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
        const response = await upload(imagesPath(), body, type);

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('INVALID_IMAGE');
        expect(await identifierImages()).toEqual([]);
      });

      it('refuses a file over the size limit', async () => {
        const response = await upload(
          imagesPath(),
          Buffer.alloc(MAX_IMAGE_BYTES + 1),
        );

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('IMAGE_TOO_LARGE');
      });

      it('reorders the photos', async () => {
        const [first, second] = await uploadTwo();

        const response = await api.post(
          `${imagesPath()}/order`,
          { ids: [second.id, first.id] },
          adminHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.images).toEqual([second, first]);
        expect(await identifierImages()).toEqual([second, first]);
      });

      it('refuses an order that does not list every photo once', async () => {
        const [first] = await uploadTwo();

        const response = await api
          .post(
            `${imagesPath()}/order`,
            { ids: [first.id, first.id] },
            adminHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(400);
        expect(response.data.code).toBe('INVALID_FIELD');
      });

      it('shows the photos only on their own brand-number page, in order, without stored files or provenance', async () => {
        const [first, second] = await uploadTwo();
        await publishAllNumbers(getContainer());

        const response = await api.get('/store/part-pages', storeHeaders);
        const page = (id: string) =>
          response.data.pages.find(
            (candidate: { id: string }) => candidate.id === id,
          );
        const published = [first, second].map(
          ({ src, width, height, srcset }) => ({ src, width, height, srcset }),
        );

        expect(page(mannId).images).toEqual(published);
        expect(page(mannId).part).not.toHaveProperty('images');
        expect(page(bmwId).images).toEqual([]);
        expect(page(bmwId).equivalents).toEqual([
          expect.objectContaining({ id: mannId, images: published }),
        ]);
        expect(page(mannId).equivalents).toEqual([
          expect.objectContaining({ id: bmwId, images: [] }),
        ]);
      });

      it('keeps each brand-number of the Part its own photos', async () => {
        await upload(imagesPath(), await picture(1200, 900, 'png'));
        const response = await upload(
          imagesPath(bmwId),
          await picture(300, 300, 'jpeg'),
          'image/jpeg',
        );

        expect(response.status).toBe(200);
        expect(response.data.images).toHaveLength(1);
        expect((await identifierImages()).map(({ width }) => width)).toEqual([
          960,
        ]);
        expect(
          (await identifierImages(bmwId)).map(({ width }) => width),
        ).toEqual([300]);
      });

      it('answers 404 for a brand-number that does not exist', async () => {
        const response = await upload(
          imagesPath('missing'),
          await picture(300, 300, 'png'),
        );

        expect(response.status).toBe(404);
      });

      it('deletes a photo and its files', async () => {
        const [first, second] = await uploadTwo();

        const response = await api.delete(
          `${imagesPath()}/${first.id}`,
          adminHeaders,
        );

        expect(response.status).toBe(200);
        expect(response.data.images).toEqual([second]);
        for (const { url } of first.srcset) {
          expect((await staticFile(url)).status).toBe(404);
        }
        expect((await staticFile(second.src)).status).toBe(200);
      });

      it('answers 404 for a photo the brand-number does not have', async () => {
        const response = await api
          .delete(`${imagesPath()}/missing`, adminHeaders)
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
