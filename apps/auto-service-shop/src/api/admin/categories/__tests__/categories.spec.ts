import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

type Response = {
  status: number;
  data: Record<
    string,
    {
      id: string;
      slug: string;
      key: string;
      name: string;
      installation_price: number | null;
    }
  >;
};

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin categories and part attributes', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let brandId: string;
      let serial = 0;

      const post = (path: string, body: unknown): Promise<Response> =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const remove = (path: string): Promise<Response> =>
        api.delete(path, adminHeaders).catch((error) => error.response);

      const createOilCategory = async () => {
        serial += 1;
        const name = `Моторное масло ${serial}`;
        const category = (
          await post('/admin/categories', {
            slug: `engine-oil-${serial}`,
            name,
            text: 'Масло для двигателя.',
          })
        ).data.category;
        const base = `/admin/categories/${category.id}/fields`;
        const viscosity = (
          await post(base, {
            key: 'viscosity',
            type: 'single-select',
            label: 'Вязкость',
            required: true,
            facet: true,
            rank: 1,
          })
        ).data.field;
        const approvals = (
          await post(base, {
            key: 'approvals',
            type: 'multi-select',
            label: 'Допуски',
            facet: true,
            rank: 2,
          })
        ).data.field;
        const volume = (
          await post(base, {
            key: 'volume',
            type: 'number',
            unit: 'l',
            label: 'Объем',
            rank: 3,
          })
        ).data.field;
        for (const [field, keys] of [
          [viscosity, ['5w-30', '0w-20']],
          [approvals, ['bmw-ll-04', 'mb-229-51']],
        ] as const) {
          for (const [rank, key] of keys.entries()) {
            await post(`${base}/${field.id}/options`, {
              key,
              label: key.toUpperCase(),
              rank,
            });
          }
        }
        return { category, name, viscosity, approvals, volume, base };
      };

      const createPart = async (
        category_id: string,
        attributes: Record<string, unknown>,
      ): Promise<Response> => {
        serial += 1;
        return post('/admin/parts', {
          name: `Oil ${serial}`,
          category_id,
          attributes,
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: brandId,
              value: `OIL-${serial}`,
            },
          ],
        });
      };

      const optionId = async (fieldId: string, key: string) =>
        (await catalog.listCategoryFieldOptions({ field_id: fieldId, key }))[0]
          .id;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        brandId = (
          await catalog.createBrands({ name: 'Castrol', slug: 'castrol' })
        ).id;
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@categories-tests.local',
          'supersecret',
        );
      });

      it('lists a Category with its fields and options in rank order', async () => {
        const { category, name } = await createOilCategory();

        const listed = await api.get('/admin/categories', adminHeaders);

        const found = listed.data.categories.find(
          ({ id }: { id: string }) => id === category.id,
        );
        expect(found).toMatchObject({
          slug: category.slug,
          name,
          text: 'Масло для двигателя.',
          translations: null,
          source: 'manual',
          created_by: expect.stringMatching(/^user_/),
          fields: [
            {
              key: 'viscosity',
              type: 'single-select',
              unit: null,
              label: 'Вязкость',
              required: true,
              facet: true,
              rank: 1,
              options: [
                expect.objectContaining({ key: '5w-30', label: '5W-30' }),
                expect.objectContaining({ key: '0w-20', label: '0W-20' }),
              ],
            },
            expect.objectContaining({ key: 'approvals' }),
            expect.objectContaining({ key: 'volume', unit: 'l', options: [] }),
          ],
        });
      });

      it('stores Part values keyed by field key with option keys', async () => {
        const { category } = await createOilCategory();
        const attributes = {
          viscosity: '5w-30',
          approvals: ['bmw-ll-04', 'mb-229-51'],
          volume: 5,
        };

        const response = await createPart(category.id, attributes);

        expect(response.status).toBe(200);
        expect(await catalog.retrievePart(response.data.part.id)).toMatchObject(
          { category_id: category.id, attributes },
        );
      });

      it.each([
        ['an unknown option', { viscosity: '10w-60' }],
        ['a missing required field', { volume: 5 }],
        ['an unknown field', { viscosity: '5w-30', colour: 'black' }],
        ['a number as text', { viscosity: '5w-30', volume: '5' }],
      ])(
        'refuses a Part with %s and creates nothing',
        async (_, attributes) => {
          const { category } = await createOilCategory();

          const response = await createPart(category.id, attributes);

          expect(response.status).toBe(400);
          expect(
            await catalog.listParts({ category_id: category.id }),
          ).toHaveLength(0);
        },
      );

      it('names the field label of a negative volume', async () => {
        const { category } = await createOilCategory();

        const response = await createPart(category.id, {
          viscosity: '5w-30',
          volume: -5,
        });

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_ATTRIBUTES',
          field: 'volume',
          label: 'Объем',
        });
      });

      it('classifies an existing Part and refuses values that break the definition', async () => {
        const { category } = await createOilCategory();
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Unclassified oil',
          identifiers: [
            { type: 'manufacturer-number', brand_id: brandId, value: 'UNCL-1' },
          ],
        });

        const refused = await post(`/admin/parts/${partId}`, {
          category_id: category.id,
          attributes: { viscosity: 'nope' },
        });
        const accepted = await post(`/admin/parts/${partId}`, {
          category_id: category.id,
          attributes: { viscosity: '0w-20' },
        });

        expect(refused.status).toBe(400);
        expect(accepted.status).toBe(200);
        expect(await catalog.retrievePart(partId)).toMatchObject({
          category_id: category.id,
          attributes: { viscosity: '0w-20' },
          updated_by: expect.stringMatching(/^user_/),
        });
      });

      it('keeps attributes while the Category stays and clears them only when it changes', async () => {
        const { category } = await createOilCategory();
        const part = (
          await createPart(category.id, { viscosity: '5w-30', volume: 4 })
        ).data.part;
        serial += 1;
        const bare = (
          await post('/admin/categories', {
            slug: `bare-${serial}`,
            name: `Bare ${serial}`,
            text: 'Bare.',
          })
        ).data.category;

        const same = await post(`/admin/parts/${part.id}`, {
          category_id: category.id,
        });
        expect(same.status).toBe(200);
        expect((await catalog.retrievePart(part.id)).attributes).toEqual({
          viscosity: '5w-30',
          volume: 4,
        });

        const edited = await post(`/admin/parts/${part.id}`, {
          attributes: { viscosity: '0w-20' },
        });
        expect(edited.status).toBe(200);
        expect((await catalog.retrievePart(part.id)).attributes).toEqual({
          viscosity: '0w-20',
        });

        const moved = await post(`/admin/parts/${part.id}`, {
          category_id: bare.id,
        });
        expect(moved.status).toBe(200);
        expect(await catalog.retrievePart(part.id)).toMatchObject({
          category_id: bare.id,
          attributes: {},
        });
      });

      it('refuses a Part in an unknown Category', async () => {
        expect((await createPart('category_missing', {})).status).toBe(404);
      });

      it('renaming an option leaves Parts intact', async () => {
        const { category, viscosity, base } = await createOilCategory();
        const part = (await createPart(category.id, { viscosity: '5w-30' }))
          .data.part;
        const id = await optionId(viscosity.id, '5w-30');

        const renamed = await post(`${base}/${viscosity.id}/options/${id}`, {
          label: 'SAE 5W-30',
        });

        expect(renamed.status).toBe(200);
        expect(renamed.data.option).toMatchObject({
          key: '5w-30',
          label: 'SAE 5W-30',
        });
        expect((await catalog.retrievePart(part.id)).attributes).toEqual({
          viscosity: '5w-30',
        });
      });

      it('refuses an option label another option of the field has in any case', async () => {
        const { viscosity, base } = await createOilCategory();
        const id = await optionId(viscosity.id, '0w-20');

        const created = await post(`${base}/${viscosity.id}/options`, {
          key: '5w-30-copy',
          label: '5w-30',
        });
        const renamed = await post(`${base}/${viscosity.id}/options/${id}`, {
          label: ' 5W-30 ',
        });
        const kept = await post(`${base}/${viscosity.id}/options/${id}`, {
          label: '0w-20',
        });

        for (const response of [created, renamed]) {
          expect(response.status).toBe(409);
          expect(response.data).toMatchObject({
            code: 'ALREADY_EXISTS',
            entity: 'category_field_option_label',
          });
        }
        expect(kept.status).toBe(200);
      });

      it('refuses to change an option key', async () => {
        const { viscosity, base } = await createOilCategory();
        const id = await optionId(viscosity.id, '5w-30');

        const response = await post(`${base}/${viscosity.id}/options/${id}`, {
          key: '5w-40',
        });

        expect(response.status).toBe(400);
      });

      it('refuses deleting an option a Part uses and deletes an unused one', async () => {
        const { category, approvals, base } = await createOilCategory();
        await createPart(category.id, {
          viscosity: '5w-30',
          approvals: ['bmw-ll-04'],
        });

        const used = await remove(
          `${base}/${approvals.id}/options/${await optionId(approvals.id, 'bmw-ll-04')}`,
        );
        const unused = await remove(
          `${base}/${approvals.id}/options/${await optionId(approvals.id, 'mb-229-51')}`,
        );

        expect(used.status).toBe(400);
        expect(unused.status).toBe(200);
        expect(
          (
            await catalog.listCategoryFieldOptions({ field_id: approvals.id })
          ).map(({ key }) => key),
        ).toEqual(['bmw-ll-04']);
      });

      it('refuses deleting or retyping a field a Part uses', async () => {
        const { category, approvals, base } = await createOilCategory();
        await createPart(category.id, {
          viscosity: '5w-30',
          approvals: ['bmw-ll-04'],
        });

        expect((await remove(`${base}/${approvals.id}`)).status).toBe(400);
        expect(
          (await post(`${base}/${approvals.id}`, { type: 'text' })).status,
        ).toBe(400);
        expect(await catalog.retrieveCategoryField(approvals.id)).toMatchObject(
          {
            type: 'multi-select',
          },
        );
      });

      it('deletes an unused field with its options and relabels a used one', async () => {
        const { category, approvals, volume, base } = await createOilCategory();
        await createPart(category.id, { viscosity: '5w-30', volume: 4.5 });

        expect((await remove(`${base}/${approvals.id}`)).status).toBe(200);
        expect(
          await catalog.listCategoryFieldOptions({ field_id: approvals.id }),
        ).toHaveLength(0);
        const relabelled = await post(`${base}/${volume.id}`, {
          label: 'Объем канистры',
          unit: 'L',
          facet: true,
        });
        expect(relabelled.status).toBe(200);
        expect(relabelled.data.field).toMatchObject({
          key: 'volume',
          label: 'Объем канистры',
          facet: true,
        });
      });

      it('refuses a required field that existing Parts lack', async () => {
        const { category, base } = await createOilCategory();
        await createPart(category.id, { viscosity: '5w-30' });

        const response = await post(base, {
          key: 'base-oil',
          type: 'text',
          label: 'База',
          required: true,
        });

        expect(response.status).toBe(400);
      });

      it.each([
        [
          'an upper-case slug',
          '/admin/categories',
          { slug: 'Oil', name: 'Масло' },
        ],
        ['an empty name', '/admin/categories', { slug: 'oil', name: '' }],
        [
          'an unknown key',
          '/admin/categories',
          { slug: 'oil', name: 'Масло', icon: 'x' },
        ],
      ])('returns a 400 for %s', async (_, path, body) => {
        expect((await post(path, body)).status).toBe(400);
      });

      it.each([
        ['an unknown field type', { key: 'x', type: 'colour', label: 'X' }],
        ['a key with spaces', { key: 'a b', type: 'text', label: 'X' }],
      ])('returns a 400 for a field with %s', async (_, body) => {
        const { base } = await createOilCategory();
        expect((await post(base, body)).status).toBe(400);
      });

      it('refuses a second field with the same key in one Category', async () => {
        const { base } = await createOilCategory();

        const response = await post(base, {
          key: 'volume',
          type: 'number',
          label: 'Еще объем',
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({ code: 'ALREADY_EXISTS' });
      });

      it.each(['brand', 'in-stock', 'price'])(
        'refuses the key %s, taken by the storefront filters',
        async (key) => {
          const { base } = await createOilCategory();

          const response = await post(base, {
            key,
            type: 'number',
            label: 'Занятый ключ',
          });

          expect(response.status).toBe(400);
          expect(response.data).toMatchObject({
            code: 'INVALID_FIELD',
            field: 'key',
          });
        },
      );

      it('refuses a Category name that differs from a stored one only by case', async () => {
        const { name } = await createOilCategory();

        const response = await post('/admin/categories', {
          slug: 'engine-oil-copy',
          name: ` ${name.toUpperCase()} `,
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'category',
        });
      });

      it('returns a 404 for a field of another Category', async () => {
        const first = await createOilCategory();
        const second = await createOilCategory();

        const response = await remove(`${second.base}/${first.volume.id}`);

        expect(response.status).toBe(404);
      });

      it('updates a Category name and text but never its slug', async () => {
        const { category } = await createOilCategory();

        const response = await post(`/admin/categories/${category.id}`, {
          name: 'Масло моторное',
          text: 'Новый текст.',
        });
        const slugChange = await post(`/admin/categories/${category.id}`, {
          slug: 'other-slug',
        });

        expect(response.status).toBe(200);
        expect(response.data.category).toMatchObject({
          slug: category.slug,
          name: 'Масло моторное',
          text: 'Новый текст.',
        });
        expect(slugChange.status).toBe(400);
      });

      it('refuses deleting a Category its Parts use and deletes an unused one with its fields', async () => {
        const used = await createOilCategory();
        await createPart(used.category.id, { viscosity: '5w-30' });
        const unused = await createOilCategory();

        const refused = await remove(`/admin/categories/${used.category.id}`);
        expect(refused.status).toBe(409);
        expect(refused.data).toMatchObject({
          code: 'IN_USE',
          holders: [{ entity: 'part', count: 1 }],
        });
        expect(
          (await remove(`/admin/categories/${unused.category.id}`)).status,
        ).toBe(200);
        expect(
          await catalog.listCategoryFields({ category_id: unused.category.id }),
        ).toHaveLength(0);
      });

      it('sets, changes and clears the add-on service of a Category', async () => {
        const { category } = await createOilCategory();
        const path = `/admin/categories/${category.id}`;

        const set = await post(path, {
          service_label: 'Регистрация аккумулятора',
          service_price: 2500,
          service_note: ' На BMW после замены нужна регистрация. ',
        });
        expect(set.status).toBe(200);
        expect(set.data.category).toMatchObject({
          service_label: 'Регистрация аккумулятора',
          service_price: 2500,
          service_note: 'На BMW после замены нужна регистрация.',
        });

        expect(
          (await post(path, { service_price: 3000 })).data.category,
        ).toMatchObject({
          service_label: 'Регистрация аккумулятора',
          service_price: 3000,
        });

        expect(
          (
            await post(path, {
              service_label: '',
              service_price: null,
              service_note: '',
            })
          ).data.category,
        ).toMatchObject({
          service_label: null,
          service_price: null,
          service_note: null,
        });
      });

      it.each([
        [
          'a price without a label',
          { service_price: 2500 },
          'FIELD_REQUIRED',
          'service_label',
        ],
        [
          'a label without a price',
          { service_label: 'Регистрация' },
          'FIELD_REQUIRED',
          'service_price',
        ],
        [
          'a negative price',
          { service_label: 'Регистрация', service_price: -1 },
          'INVALID_FIELD',
          'service_price',
        ],
        [
          'a fractional price',
          { service_label: 'Регистрация', service_price: 99.5 },
          'INVALID_FIELD',
          'service_price',
        ],
      ])('refuses an add-on service with %s', async (_, body, code, field) => {
        const { category } = await createOilCategory();

        const response = await post(`/admin/categories/${category.id}`, body);

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({ code, field });
      });

      it('sets and clears the installation price of a Category, free included', async () => {
        const { category } = await createOilCategory();
        const path = `/admin/categories/${category.id}`;
        expect(category.installation_price).toBeNull();

        expect(
          (await post(path, { installation_price: 0 })).data.category,
        ).toMatchObject({ installation_price: 0 });
        expect(
          (await post(path, { installation_price: 1500 })).data.category,
        ).toMatchObject({ installation_price: 1500 });
        expect(
          (await post(path, { installation_price: null })).data.category,
        ).toMatchObject({ installation_price: null });

        const refused = await post(path, { installation_price: -1 });
        expect(refused.status).toBe(400);
        expect(refused.data).toMatchObject({
          code: 'INVALID_FIELD',
          field: 'installation_price',
        });
      });

      it('lets a Part inherit, override, give free or refuse installation', async () => {
        const { category } = await createOilCategory();
        const created = await createPart(category.id, {
          viscosity: '5w-30',
        });
        const path = `/admin/parts/${created.data.part.id}`;
        const listed = async () =>
          (
            await api.get(
              `/admin/parts?q=${encodeURIComponent(created.data.part.name)}`,
              adminHeaders,
            )
          ).data.parts[0];
        expect(await listed()).toMatchObject({
          installation_price: null,
          no_installation: false,
        });

        expect(
          (await post(path, { installation_price: 0 })).data.part,
        ).toMatchObject({ installation_price: 0, no_installation: false });
        expect(
          (await post(path, { no_installation: true })).data.part,
        ).toMatchObject({ no_installation: true });
        expect(await listed()).toMatchObject({
          installation_price: 0,
          no_installation: true,
          attributes: { viscosity: '5w-30' },
        });
        expect(
          (
            await post(path, {
              installation_price: null,
              no_installation: false,
            })
          ).data.part,
        ).toMatchObject({ installation_price: null, no_installation: false });

        expect((await post(path, { installation_price: 1.5 })).status).toBe(
          400,
        );
      });

      it('refuses clearing the label of a priced add-on service', async () => {
        const { category } = await createOilCategory();
        const path = `/admin/categories/${category.id}`;
        await post(path, { service_label: 'Регистрация', service_price: 0 });

        const response = await post(path, { service_label: '  ' });

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'FIELD_REQUIRED',
          field: 'service_label',
        });
      });
    });
  },
});
