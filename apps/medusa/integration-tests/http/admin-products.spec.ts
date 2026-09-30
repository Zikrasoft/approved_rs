import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { queryOne } from '../../src/lib/query';
import { DEFAULT_OPTION, SHOP } from '../../src/lib/shop';
import { seedBase } from '../../src/scripts/seed-base';
import { VEHICLES } from '../../src/scripts/vehicle-fixture';
import { adminHeaders } from './admin-session';

jest.setTimeout(180_000);

const [MAKE] = VEHICLES;
const [MODEL] = MAKE.models;
const [GENERATION] = MODEL.generations;

const KNOWN_CAR = {
  make: MAKE.name,
  model: MODEL.name,
  yearFrom: GENERATION.yearFrom,
  yearTo: GENERATION.yearTo,
};

const FOREIGN_MODEL = VEHICLES.flatMap((make) =>
  make.models.map((model) => model.name),
).find((name) => !MAKE.models.some((model) => model.name === name)) as string;

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    beforeAll(() =>
      seedBase(
        getContainer(),
        getContainer().resolve(ContainerRegistrationKeys.LOGGER),
      ),
    );

    const admin = async () => ({
      headers: await adminHeaders(api, getContainer),
    });

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY);

    const draft = (title: string, extra: object = {}) => ({
      title,
      options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION] }],
      variants: [
        {
          title: DEFAULT_OPTION,
          options: { [DEFAULT_OPTION]: DEFAULT_OPTION },
          prices: [{ currency_code: SHOP.currency, amount: 1000 }],
        },
      ],
      ...extra,
    });

    const SPEC = {
      brand: 'Bosch',
      capacityAh: 60,
      crankingA: 540,
      polarity: 'left',
      lengthMm: 242,
      widthMm: 175,
      heightMm: 175,
      warrantyMonths: 24,
    };

    const batteryTypeId = async (): Promise<string> => {
      const {
        data: [type],
      } = await query().graph({
        entity: 'product_type',
        fields: ['id'],
        filters: { value: 'batteries' },
      });
      return type.id;
    };

    it('refuses to publish a battery without its spec, in Russian', async () => {
      const error = await api
        .post(
          '/admin/products',
          draft('Varta без характеристик', {
            status: 'published',
            type_id: await batteryTypeId(),
          }),
          await admin(),
        )
        .catch((failure) => failure);

      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toMatch(
        /^Товар не выпустить на сайт: /,
      );
    });

    it('publishes a battery whose spec fits the registry', async () => {
      const { data } = await api.post(
        '/admin/products',
        draft('Varta с характеристиками', {
          status: 'published',
          type_id: await batteryTypeId(),
          metadata: { spec: SPEC, fitment: [] },
        }),
        await admin(),
      );

      expect(data.product.status).toBe('published');
    });

    it('keeps a published battery editable and refuses to un-type it', async () => {
      const headers = await admin();
      const { data } = await api.post(
        '/admin/products',
        draft('Varta опубликованная', {
          status: 'published',
          type_id: await batteryTypeId(),
          metadata: { spec: SPEC, fitment: [] },
        }),
        headers,
      );

      const { data: renamed } = await api.post(
        `/admin/products/${data.product.id}`,
        { title: 'Varta переименованная' },
        headers,
      );
      expect(renamed.product.title).toBe('Varta переименованная');

      const error = await api
        .post(`/admin/products/${data.product.id}`, { type_id: null }, headers)
        .catch((failure) => failure);
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toMatch(
        /^Характеристики товара не сходятся: /,
      );
      const { data: kept } = await api.get(
        `/admin/products/${data.product.id}?fields=type_id`,
        headers,
      );
      expect(kept.product.type_id).not.toBeNull();
    });

    it.each(['/admin/products/imports', '/admin/products/import'])(
      'refuses a product import at %s',
      async (path) => {
        const error = await api
          .post(path, {}, await admin())
          .catch((failure) => failure);

        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toBe(
          'Импорт товаров отключён — создавайте и меняйте товары в карточке',
        );
      },
    );

    it('refuses an edit that breaks the spec', async () => {
      const headers = await admin();
      const { data } = await api.post(
        '/admin/products',
        draft('Varta правка', {
          type_id: await batteryTypeId(),
          metadata: { spec: SPEC, fitment: [] },
        }),
        headers,
      );

      const error = await api
        .post(
          `/admin/products/${data.product.id}`,
          { metadata: { spec: { ...SPEC, capacityAh: 'sixty' } } },
          headers,
        )
        .catch((failure) => failure);

      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toMatch(
        /^Характеристики товара не сходятся: /,
      );
    });

    it('saves the spec without losing the other metadata keys', async () => {
      const headers = await admin();
      const { data } = await api.post(
        '/admin/products',
        draft('Varta для виджета', {
          type_id: await batteryTypeId(),
          metadata: { translated_from: 'abc123' },
        }),
        headers,
      );

      const fitment = [KNOWN_CAR];
      const { data: saved } = await api.post(
        `/admin/products/${data.product.id}/spec`,
        { spec: SPEC, fitment },
        headers,
      );

      expect(saved.metadata).toEqual({
        translated_from: 'abc123',
        spec: SPEC,
        fitment,
      });

      const error = await api
        .post(
          `/admin/products/${data.product.id}/spec`,
          { spec: { ...SPEC, capacityAh: 0 }, fitment },
          headers,
        )
        .catch((failure) => failure);
      expect(error.response.status).toBe(400);
      expect(error.response.data.message).toMatch(
        /^Характеристики не сохранены: /,
      );
    });

    it.each([
      [
        'an unknown make',
        { ...KNOWN_CAR, make: 'Nomake' },
        'марки «Nomake» нет в справочнике',
      ],
      [
        'a model filed under another make',
        { ...KNOWN_CAR, model: FOREIGN_MODEL },
        `нет модели «${FOREIGN_MODEL}»`,
      ],
      [
        'years outside every generation',
        { ...KNOWN_CAR, yearFrom: 1950 },
        'годы выходят за рамки поколений',
      ],
    ])('refuses to save %s, naming the car', async (label, car, reason) => {
      const headers = await admin();
      const { data } = await api.post(
        '/admin/products',
        draft(`Varta: ${label}`, { type_id: await batteryTypeId() }),
        headers,
      );

      const error = await api
        .post(
          `/admin/products/${data.product.id}/spec`,
          { spec: SPEC, fitment: [car] },
          headers,
        )
        .catch((failure) => failure.response);

      expect(error.status).toBe(400);
      expect(error.data.message).toContain(
        `Характеристики не сохранены: «${car.make} ${car.model} ${car.yearFrom}–${car.yearTo}»: `,
      );
      expect(error.data.message).toContain(reason);
    });

    it('refuses a product whose metadata carries an unknown car', async () => {
      const error = await api
        .post(
          '/admin/products',
          draft('Varta с чужой машиной', {
            type_id: await batteryTypeId(),
            metadata: {
              spec: SPEC,
              fitment: [{ ...KNOWN_CAR, make: 'Nomake' }],
            },
          }),
          await admin(),
        )
        .catch((failure) => failure.response);

      expect(error.status).toBe(400);
      expect(error.data.message).toMatch(
        /^Характеристики товара не сходятся: «Nomake /,
      );
    });

    it('gives a product named in Russian a Latin address, the default profile and the carlab.rs channel', async () => {
      const { data } = await api.post(
        '/admin/products',
        draft('Аккумулятор тест'),
        await admin(),
      );

      expect(data.product.handle).toBe('akkumulyator-test');

      const row = await queryOne<{
        shipping_profile?: { id: string } | null;
        sales_channels: { name: string }[];
      }>(query(), 'product', ['shipping_profile.id', 'sales_channels.name'], {
        id: data.product.id,
      });
      expect(row?.sales_channels.map((channel) => channel.name)).toEqual([
        SHOP.salesChannelName,
      ]);
      expect(row?.shipping_profile?.id).toBeTruthy();
    });

    it('gives the second product with the same Russian title a suffixed handle', async () => {
      const { data: first } = await api.post(
        '/admin/products',
        draft('Дубликат теста'),
        await admin(),
      );
      const { data: second } = await api.post(
        '/admin/products',
        draft('Дубликат теста'),
        await admin(),
      );

      expect(first.product.handle).toMatch(/^[a-z0-9-]+$/);
      expect(second.product.handle).toBe(`${first.product.handle}-2`);
    });

    it('refuses to rename a registry product type, in Russian', async () => {
      const typeId = await batteryTypeId();

      const error = await api
        .post(
          `/admin/product-types/${typeId}`,
          { value: 'renamed-batteries' },
          await admin(),
        )
        .catch((failure) => failure.response);

      expect(error.status).toBe(400);
      expect(error.data.message).toBe(
        'Тип «batteries» задан каталогом сайта — его нельзя переименовать или удалить',
      );
      const type = await queryOne<{ value: string }>(
        query(),
        'product_type',
        ['value'],
        { id: typeId },
      );
      expect(type?.value).toBe('batteries');
    });
  },
});
