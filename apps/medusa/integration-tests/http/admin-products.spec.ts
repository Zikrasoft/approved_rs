import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { DEFAULT_OPTION, SHOP } from '../../src/lib/shop';
import { seedBase } from '../../src/scripts/seed-base';
import { adminHeaders } from './admin-session';

jest.setTimeout(180_000);

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

    it('gives a product named in Russian a Latin address, the default profile and the carlab.rs channel', async () => {
      const { data } = await api.post(
        '/admin/products',
        draft('Аккумулятор тест'),
        await admin(),
      );

      expect(data.product.handle).toBe('akkumulyator-test');

      const {
        data: [rawRow],
      } = await query().graph({
        entity: 'product',
        fields: ['shipping_profile.id', 'sales_channels.name'],
        filters: { id: data.product.id },
      });
      const row = rawRow as unknown as {
        shipping_profile?: { id: string } | null;
        sales_channels: { name: string }[];
      };
      expect(row.sales_channels.map((channel) => channel.name)).toEqual([
        SHOP.salesChannelName,
      ]);
      expect(row.shipping_profile?.id).toBeTruthy();
    });
  },
});
