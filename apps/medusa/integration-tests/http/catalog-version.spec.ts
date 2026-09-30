import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { updateStoreMetadata } from '../../src/lib/metadata';
import { seedBase } from '../../src/scripts/seed-base';
import { storeHeaders } from './store-context';

jest.setTimeout(180_000);

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    beforeAll(() =>
      seedBase(
        getContainer(),
        getContainer().resolve(ContainerRegistrationKeys.LOGGER),
      ),
    );

    it('answers the storefront with a catalogue version', async () => {
      const { status, data } = await api.get('/store/catalog-version', {
        headers: await storeHeaders(getContainer),
      });

      expect(status).toBe(200);
      expect(data.version).toMatch(/^(unstamped|\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/);
    });

    it('answers only a caller holding the publishable key', async () => {
      const error = await api
        .get('/store/catalog-version')
        .catch((failure) => failure);

      expect(error.response.status).toBe(400);
    });

    it('keeps the other store metadata keys when it stamps', async () => {
      const container = getContainer();
      await updateStoreMetadata(container, { owner_note: 'keep me' });
      await updateStoreMetadata(container, { catalog_version: 'v-test' });

      const {
        data: [store],
      } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: 'store', fields: ['metadata'] });
      expect(store.metadata?.owner_note).toBe('keep me');
    });
  },
});
