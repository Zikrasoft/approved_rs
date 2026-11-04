import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

process.env.STORE_WRITES_PER_MINUTE = '120';

medusaIntegrationTestRunner({
  moduleName: 'store-guards',
  dbName: 'medusa-store-guards',
  testSuite: ({ api, getContainer }) => {
    describe('store request guards', () => {
      let publishable: string;

      beforeAll(async () => {
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        publishable = (
          await apiKeys.createApiKeys({
            title: 'store-guards-tests',
            type: 'publishable',
            created_by: 'test',
          })
        ).token;
      });

      const headers = (client = '198.51.100.10') => ({
        'x-publishable-api-key': publishable,
        'x-forwarded-for': client,
      });
      const get = (path: string) =>
        api.get(path, { headers: headers() }).catch((error) => error.response);
      const post = (path: string, body: unknown, client?: string) =>
        api
          .post(path, body, { headers: headers(client) })
          .catch((error) => error.response);

      it('answers 400 to a NUL byte in an id instead of reaching the database', async () => {
        const inPath = await get('/store/part-identifiers/%00/offers');
        const inQuery = await get('/store/offers?part_identifier_id=%00');
        const inCart = await post('/store/offer-carts/%00/items', {
          offer_id: 'offer_1',
        });

        expect([inPath.status, inQuery.status, inCart.status]).toEqual([
          400, 400, 400,
        ]);
      });

      it('refuses a store body over 32 KB', async () => {
        const answer = await post('/store/vin-lookups', {
          vin: 'A'.repeat(40_000),
        });

        expect(answer.status).toBe(413);
      });

      it('keeps a long invalid value out of the error it answers with', async () => {
        const answer = await post('/store/vin-lookups', {
          vin: ['A'.repeat(20_000)],
        });

        expect(answer.status).toBe(400);
        expect(answer.data.message.length).toBeLessThan(400);
      });

      it('answers 429 once one client sends more writes in a minute than allowed', async () => {
        const client = '203.0.113.77';
        const statuses: number[] = [];
        for (let call = 0; call < 121; call += 1) {
          const answer = await post(
            '/store/vin-lookups',
            { vin: 'WBA00000000000000' },
            client,
          );
          statuses.push(answer.status);
        }
        const other = await post(
          '/store/vin-lookups',
          { vin: 'WBA00000000000000' },
          '203.0.113.78',
        );

        expect(statuses.slice(0, 120).every((status) => status === 200)).toBe(
          true,
        );
        expect(statuses[120]).toBe(429);
        expect(other.status).toBe(200);
      });
    });
  },
});
