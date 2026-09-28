import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    it('answers ready once the database and the cache answer', async () => {
      const { status, data } = await api.get('/health/ready');

      expect(status).toBe(200);
      expect(data).toEqual({ status: 'ok' });
    });

    it('loads the translation module with the locales it seeds', async () => {
      const translation = getContainer().resolve(Modules.TRANSLATION);

      expect(await translation.listLocales({ code: 'ru-RU' })).toHaveLength(1);
    });

    it('runs events through Redis, so a failing subscriber is retried', () => {
      expect(getContainer().resolve(Modules.EVENT_BUS).constructor.name).toBe(
        'RedisEventBusService',
      );
    });
  },
});
