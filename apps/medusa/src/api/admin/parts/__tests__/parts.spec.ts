import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';

const ADMIN_EMAIL = 'admin@parts-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'part',
  testSuite: ({ api, getContainer }) => {
    describe('admin parts curation', () => {
      let adminHeaders: { headers: { authorization: string } };
      let partModuleService: PartModuleService;

      beforeAll(async () => {
        partModuleService = getContainer().resolve(PART_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      describe('GET /admin/parts', () => {
        it('finds an existing Part by one of its PartIdentifier numbers', async () => {
          const part = await partModuleService.createParts({
            name: 'Admin-test find part',
          });
          await partModuleService.createPartIdentifiers({
            part_id: part.id,
            type: 'oem',
            brand: 'BMW',
            value: 'FIND-ME-OEM-1',
          });

          const response = await api.get(
            '/admin/parts?q=FIND-ME-OEM-1',
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.parts).toHaveLength(1);
          expect(response.data.parts[0]).toMatchObject({
            id: part.id,
            name: 'Admin-test find part',
          });
        });

        it('returns no parts for a number nothing matches', async () => {
          const response = await api.get(
            '/admin/parts?q=NOTHING-MATCHES-THIS-1',
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.parts).toHaveLength(0);
        });
      });

      describe('POST /admin/parts', () => {
        it('creates a new Part with its first PartIdentifier as the fallback', async () => {
          const searchBefore = await api.get(
            '/admin/parts?q=NEW-FALLBACK-OEM-1',
            adminHeaders,
          );
          expect(searchBefore.data.parts).toHaveLength(0);

          const response = await api.post(
            '/admin/parts',
            {
              name: 'Admin-test fallback part',
              identifier: {
                type: 'oem',
                brand: 'BMW',
                value: 'NEW-FALLBACK-OEM-1',
              },
            },
            adminHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.part).toMatchObject({
            name: 'Admin-test fallback part',
            identifiers: [
              expect.objectContaining({
                type: 'oem',
                brand: 'BMW',
                value: 'NEW-FALLBACK-OEM-1',
              }),
            ],
          });

          const parts = await partModuleService.listParts({
            id: [response.data.part.id],
          });
          expect(parts).toHaveLength(1);
        });
      });
    });
  },
});
