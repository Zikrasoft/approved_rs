import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const ADMIN_EMAIL = 'admin@parts-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('admin parts curation', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let supplierService: SupplierModuleService;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        supplierService = getContainer().resolve(SUPPLIER_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      describe('GET /admin/parts', () => {
        it('finds an existing Part by one of its PartIdentifier numbers', async () => {
          const part = await catalog.createParts({
            name: 'Admin-test find part',
          });
          await catalog.createPartIdentifiers({
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

        it('returns a 400 without a search query', async () => {
          const response = await api
            .get('/admin/parts', adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
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

          const parts = await catalog.listParts({
            id: [response.data.part.id],
          });
          expect(parts).toHaveLength(1);
        });

        it('stamps the Part and its PartIdentifier with the admin and a manual source', async () => {
          const response = await api.post(
            '/admin/parts',
            {
              name: 'Admin-test provenance part',
              identifier: { type: 'oem', brand: 'BMW', value: 'PROVENANCE-1' },
            },
            adminHeaders,
          );

          const part = await catalog.retrievePart(response.data.part.id, {
            relations: ['identifiers'],
          });
          const adminId = part.created_by;

          expect(adminId).toMatch(/^user_/);
          expect(part).toMatchObject({
            source: 'manual',
            updated_by: adminId,
            created_at: expect.any(Date),
            updated_at: expect.any(Date),
          });
          expect(part.identifiers[0]).toMatchObject({
            source: 'manual',
            created_by: adminId,
            updated_by: adminId,
          });
        });

        it.each([
          [
            'an empty name',
            {
              name: '',
              identifier: { type: 'oem', brand: 'BMW', value: 'X-1' },
            },
          ],
          [
            'an unknown identifier type',
            {
              name: 'Part',
              identifier: { type: 'sku', brand: 'BMW', value: 'X-2' },
            },
          ],
          ['no identifier', { name: 'Part' }],
        ])('returns a 400 for %s', async (_, body) => {
          const response = await api
            .post('/admin/parts', body, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });
      });

      describe('deleting', () => {
        const createPartWithOfferAndFitment = async (value: string) => {
          const part = await catalog.createParts({ name: `Delete ${value}` });
          const identifier = await catalog.createPartIdentifiers({
            part_id: part.id,
            type: 'oem',
            brand: 'BMW',
            value,
          });
          const supplier = await supplierService.createSuppliers({
            name: `Supplier ${value}`,
            markup_percentage: 10,
          });
          const offer = await supplierService.createSupplierOffers({
            part_identifier_id: identifier.id,
            supplier_id: supplier.id,
            supplier_article_id: `ART-${value}`,
            cost_price: 1000,
            stock_quantity: 1,
            lead_time: 'in_stock',
          });
          const vehicle = await catalog.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: `B47-${value}`,
          });
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
          });
          return { part, identifier, offer, vehicle, fitment };
        };

        it('deleting a Part removes its identifiers, offers and Fitments but keeps the Vehicle', async () => {
          const { part, identifier, offer, vehicle, fitment } =
            await createPartWithOfferAndFitment('DELETE-PART-1');

          const response = await api.delete(
            `/admin/parts/${part.id}`,
            adminHeaders,
          );

          expect(response.data).toEqual({
            id: part.id,
            object: 'part',
            deleted: true,
          });
          expect(await catalog.listParts({ id: part.id })).toHaveLength(0);
          expect(
            await catalog.listPartIdentifiers({ id: identifier.id }),
          ).toHaveLength(0);
          expect(await catalog.listFitments({ id: fitment.id })).toHaveLength(
            0,
          );
          expect(
            await supplierService.listSupplierOffers({ id: offer.id }),
          ).toHaveLength(0);
          expect(await catalog.listVehicles({ id: vehicle.id })).toHaveLength(
            1,
          );
        });

        it('deleting a PartIdentifier removes its offers but keeps the Part', async () => {
          const { part, identifier, offer } =
            await createPartWithOfferAndFitment('DELETE-IDENTIFIER-1');

          await api.delete(
            `/admin/part-identifiers/${identifier.id}`,
            adminHeaders,
          );

          expect(
            await catalog.listPartIdentifiers({ id: identifier.id }),
          ).toHaveLength(0);
          expect(
            await supplierService.listSupplierOffers({ id: offer.id }),
          ).toHaveLength(0);
          expect(await catalog.listParts({ id: part.id })).toHaveLength(1);
        });

        it('returns a 404 for an unknown Part', async () => {
          const response = await api
            .delete('/admin/parts/part_missing', adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });
    });
  },
});
