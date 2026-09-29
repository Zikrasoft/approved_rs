import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { publicVehicleTree } from '../../src/lib/vehicle-tree';
import { loadVehicleTree } from '../../src/lib/vehicles';
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

    it('serves whatever the vehicle module holds, shaped for the storefront', async () => {
      const { status, data } = await api.get('/store/vehicles', {
        headers: await storeHeaders(getContainer),
      });

      expect(status).toBe(200);
      expect(data).toEqual(
        publicVehicleTree(await loadVehicleTree(getContainer())),
      );
      expect(data.makes.length).toBeGreaterThan(0);
      expect(JSON.stringify(data)).not.toMatch(/"id"|"source"/);
    });

    it('answers only a caller holding the publishable key', async () => {
      const error = await api
        .get('/store/vehicles')
        .catch((failure) => failure);

      expect(error.response.status).toBe(400);
    });
  },
});
