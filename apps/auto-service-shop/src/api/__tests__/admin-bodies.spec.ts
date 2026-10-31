import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../integration-tests/adminAuth';
import middlewares from '../middlewares';

const writes = [
  ...new Set([
    ...(middlewares.routes ?? [])
      .filter(
        ({ matcher, methods }) =>
          String(matcher).startsWith('/admin') && methods?.includes('POST'),
      )
      .map(({ matcher }) => String(matcher)),
  ]),
].map((matcher) => matcher.replace(/:\w+/g, 'missing_id'));

medusaIntegrationTestRunner({
  moduleName: 'admin-bodies',
  testSuite: ({ api, getContainer }) => {
    describe('admin write bodies', () => {
      let adminHeaders: { headers: { authorization: string } };

      beforeAll(async () => {
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@bodies-tests.local',
          'supersecret',
        );
      });

      it('covers every admin write route', () => {
        expect(writes).toEqual(
          expect.arrayContaining([
            '/admin/makes',
            '/admin/vehicles/missing_id',
            '/admin/brands',
            '/admin/parts/missing_id/identifiers',
            '/admin/fitments/missing_id',
          ]),
        );
      });

      it.each(writes)('refuses an unknown key posted to %s', async (path) => {
        const response = await api
          .post(path, { __unknown: 1 }, adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_FIELD',
          message: expect.stringContaining('__unknown'),
        });
      });
    });
  },
});
