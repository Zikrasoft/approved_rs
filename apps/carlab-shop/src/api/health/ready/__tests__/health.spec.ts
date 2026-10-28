import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { asValue } from '@medusajs/framework/awilix';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-health',
  testSuite: ({ api, getContainer }) => {
    describe('GET /health/ready', () => {
      const health = () =>
        api.get('/health/ready').catch((error) => error.response);

      it('answers ok while Postgres and Typesense both answer', async () => {
        const response = await health();

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ status: 'ok' });
      });

      it('fails without naming the cause when Typesense is down', async () => {
        const port = process.env.TYPESENSE_PORT;
        process.env.TYPESENSE_PORT = '1';
        try {
          const response = await health();

          expect(response.status).toBe(503);
          expect(response.data).toEqual({ status: 'unavailable' });
        } finally {
          process.env.TYPESENSE_PORT = port;
        }
      });

      it('fails without naming the cause when Postgres is down', async () => {
        const container = getContainer();
        const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
        container.register(
          ContainerRegistrationKeys.PG_CONNECTION,
          asValue({
            raw: () =>
              Promise.reject(new Error('connect ECONNREFUSED secret-host')),
          }),
        );
        try {
          const response = await health();

          expect(response.status).toBe(503);
          expect(response.data).toEqual({ status: 'unavailable' });
        } finally {
          container.register(
            ContainerRegistrationKeys.PG_CONNECTION,
            asValue(pg),
          );
        }
      });
    });
  },
});
