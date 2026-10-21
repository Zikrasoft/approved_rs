import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
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
      let bmw: { id: string };

      const createPart = (name: string, ...values: string[]) =>
        api.post(
          '/admin/parts',
          {
            name,
            identifiers: values.map((value) => ({
              type: 'oem',
              brand_id: bmw.id,
              value,
            })),
          },
          adminHeaders,
        );

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        supplierService = getContainer().resolve(SUPPLIER_MODULE);
        bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      describe('GET /admin/parts', () => {
        beforeAll(async () => {
          await createPart('Admin-test find part', '11 42 8575777');
        });

        it.each(['11 42 8575 777', '11428575777', '11-42.8575/777'])(
          'finds a Part by its number spelled %j',
          async (q) => {
            const response = await api.get(
              `/admin/parts?q=${encodeURIComponent(q)}`,
              adminHeaders,
            );

            expect(response.status).toBe(200);
            expect(response.data.parts).toHaveLength(1);
            expect(response.data.parts[0]).toMatchObject({
              name: 'Admin-test find part',
              identifiers: [
                expect.objectContaining({
                  value: '11 42 8575777',
                  normalized_value: '11428575777',
                  brand: expect.objectContaining({ name: 'BMW', slug: 'bmw' }),
                }),
              ],
            });
          },
        );

        it('finds a Part by a lower-cased number', async () => {
          await createPart('Admin-test cased part', 'HU 816 x');

          const response = await api.get('/admin/parts?q=hu816X', adminHeaders);

          expect(response.data.parts).toEqual([
            expect.objectContaining({ name: 'Admin-test cased part' }),
          ]);
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

          const response = await createPart(
            'Admin-test fallback part',
            'NEW-FALLBACK-OEM-1',
          );

          expect(response.status).toBe(200);
          expect(response.data.part).toMatchObject({
            name: 'Admin-test fallback part',
            identifiers: [
              expect.objectContaining({
                type: 'oem',
                brand: expect.objectContaining({ id: bmw.id }),
                value: 'NEW-FALLBACK-OEM-1',
                normalized_value: 'NEWFALLBACKOEM1',
              }),
            ],
          });

          const parts = await catalog.listParts({
            id: [response.data.part.id],
          });
          expect(parts).toHaveLength(1);
        });

        it('stamps the Part and its PartIdentifier with the admin and a manual source', async () => {
          const response = await createPart(
            'Admin-test provenance part',
            'PROVENANCE-1',
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
              identifiers: [{ type: 'oem', brand_id: 'brand_x', value: 'X-1' }],
            },
          ],
          [
            'an unknown identifier type',
            {
              name: 'Part',
              identifiers: [{ type: 'sku', brand_id: 'brand_x', value: 'X-2' }],
            },
          ],
          ['no identifier', { name: 'Part', identifiers: [] }],
          [
            'a number with nothing but separators',
            {
              name: 'Part',
              identifiers: [{ type: 'oem', brand_id: 'brand_x', value: ' - ' }],
            },
          ],
        ])('returns a 400 for %s', async (_, body) => {
          const response = await api
            .post('/admin/parts', body, adminHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });
      });

      describe('part identity', () => {
        it('three spellings of one number give one PartIdentifier and the others are refused', async () => {
          const first = await createPart('Identity part', '11 42 8575 211');
          expect(first.status).toBe(200);

          for (const spelling of ['11-42-8575211', '11.42.857.52.11']) {
            const response = await createPart(
              'Identity duplicate',
              spelling,
            ).catch((error) => error.response);
            expect(response.status).toBe(400);
          }

          const identifiers = await catalog.listPartIdentifiers({
            normalized_value: '11428575211',
          });
          expect(identifiers).toHaveLength(1);
          expect(
            await catalog.listParts({ name: 'Identity duplicate' }),
          ).toHaveLength(0);
        });

        it('the same number under another Brand is a different PartIdentifier', async () => {
          const mann = await catalog.createBrands({
            name: 'Mann-Filter',
            slug: 'mann-filter',
          });

          const response = await api.post(
            '/admin/parts',
            {
              name: 'Other brand part',
              identifiers: [
                { type: 'oem', brand_id: mann.id, value: '11 42 8575 211' },
              ],
            },
            adminHeaders,
          );

          expect(response.status).toBe(200);
        });

        it('a failed create leaves neither the Part nor its other identifiers', async () => {
          await createPart('Transaction seed part', 'TX-EXISTING-1');

          const response = await createPart(
            'Transaction failed part',
            'TX-NEW-1',
            'tx existing 1',
          ).catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(
            await catalog.listParts({ name: 'Transaction failed part' }),
          ).toHaveLength(0);
          expect(
            await catalog.listPartIdentifiers({ normalized_value: 'TXNEW1' }),
          ).toHaveLength(0);
        });

        it('refuses an unknown Brand', async () => {
          const response = await api
            .post(
              '/admin/parts',
              {
                name: 'Unknown brand part',
                identifiers: [
                  { type: 'oem', brand_id: 'brand_missing', value: 'UB-1' },
                ],
              },
              adminHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(
            await catalog.listParts({ name: 'Unknown brand part' }),
          ).toHaveLength(0);
        });
      });

      describe('deleting', () => {
        const createPartWithOfferAndFitment = async (value: string) => {
          const partId = await catalog.createPartWithIdentifiers({
            name: `Delete ${value}`,
            identifiers: [{ type: 'oem', brand_id: bmw.id, value }],
          });
          const part = await catalog.retrievePart(partId, {
            relations: ['identifiers'],
          });
          const [identifier] = part.identifiers;
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
            lead_time_days: 0,
          });
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: value })
          ).vehicle;
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
