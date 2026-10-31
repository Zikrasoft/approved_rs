import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

type Row = { id: string };
type Response = { status: number; data: Record<string, Row> };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'carlab_requirements',
  testSuite: ({ api, getContainer }) => {
    describe('Requirements', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;

      const post = (path: string, body: unknown): Promise<Response> =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const remove = (path: string): Promise<Response> =>
        api.delete(path, adminHeaders).catch((error) => error.response);
      const requirementsOf = async (id: string) =>
        (await api.get('/store/vehicles', storeHeaders)).data.vehicles.find(
          (vehicle: Row) => vehicle.id === id,
        ).requirements as { field_key: string; option_keys: string[] | null }[];

      let oil: Row;
      let fields: Record<string, Row>;
      let b47: Awaited<ReturnType<typeof createVehicleFixture>>;
      let om654: Awaited<ReturnType<typeof createVehicleFixture>>;

      beforeAll(async () => {
        const container = getContainer();
        adminHeaders = await createAdminAuth(
          container,
          api,
          'requirements@carlab.rs',
          'secret-password',
        );
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'requirement-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };
        catalog = container.resolve(CATALOG_MODULE);

        oil = (
          await post('/admin/categories', {
            slug: 'engine-oil',
            name: 'Моторное масло',
            maintenance_kit: true,
            kit_rank: 2,
          })
        ).data.category;
        const base = `/admin/categories/${oil.id}/fields`;
        fields = {
          approvals: (
            await post(base, {
              key: 'approvals',
              type: 'multi-select',
              label: 'Допуски',
            })
          ).data.field,
          viscosity: (
            await post(base, {
              key: 'viscosity',
              type: 'single-select',
              label: 'Вязкость',
            })
          ).data.field,
          volume: (
            await post(base, {
              key: 'volume',
              type: 'number',
              unit: 'l',
              label: 'Объем',
            })
          ).data.field,
        };
        for (const key of [
          'bmw-ll-04',
          'mb-229-51',
          'mb-229-52',
          'vw-504-00',
        ]) {
          await post(`${base}/${fields.approvals.id}/options`, {
            key,
            label: key.toUpperCase(),
          });
        }
        for (const key of ['5w-30', '0w-20']) {
          await post(`${base}/${fields.viscosity.id}/options`, {
            key,
            label: key.toUpperCase(),
          });
        }

        b47 = await createVehicleFixture(catalog, { typeCode: '8C31' });
        om654 = await createVehicleFixture(catalog, {
          make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
          identifierType: 'mercedes-baumuster',
          steering: null,
          typeCode: '213004',
          modelSlug: 'w213-e220d',
          chassisCode: 'W213',
          engineCode: 'OM654D20',
          engineFamily: 'OM654',
        });
        expect(
          (
            await post('/admin/requirements', {
              field_id: fields.approvals.id,
              engine_id: b47.engine.id,
              option_keys: ['bmw-ll-04'],
              quantity: 5,
            })
          ).status,
        ).toBe(200);
        await post('/admin/requirements', {
          field_id: fields.approvals.id,
          engine_id: om654.engine.id,
          option_keys: ['mb-229-51', 'mb-229-52'],
        });
        await post('/admin/requirements', {
          field_id: fields.volume.id,
          chassis_id: b47.chassis.id,
          min: 4.5,
        });
      });

      it('gives a Vehicle the Requirements of its Engine and Chassis', async () => {
        const requirements = await requirementsOf(b47.vehicle.id);

        expect(requirements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              category_id: oil.id,
              field_key: 'approvals',
              option_keys: ['bmw-ll-04'],
              min: null,
              max: null,
              quantity: 5,
            }),
            expect.objectContaining({
              category_id: oil.id,
              field_key: 'volume',
              option_keys: null,
              min: 4.5,
              max: null,
              quantity: 1,
            }),
          ]),
        );
        expect(requirements).toHaveLength(2);
      });

      it('adds a Vehicle Requirement to its Engine one', async () => {
        const vehicle = await createVehicleFixture(catalog, {
          typeCode: '8C32',
        });
        const added = await post('/admin/requirements', {
          field_id: fields.viscosity.id,
          vehicle_id: vehicle.vehicle.id,
          option_keys: ['0w-20'],
        });

        expect(added.status).toBe(200);
        expect(await requirementsOf(vehicle.vehicle.id)).toContainEqual(
          expect.objectContaining({
            field_key: 'viscosity',
            option_keys: ['0w-20'],
          }),
        );
        expect(
          (await requirementsOf(b47.vehicle.id)).map(
            ({ field_key }) => field_key,
          ),
        ).not.toContain('viscosity');
      });

      it.each([
        ['no owner', {}],
        ['two owners', { engine_id: 'x', chassis_id: 'y' }],
      ])('refuses a Requirement with %s', async (_, owner) => {
        const response = await post('/admin/requirements', {
          field_id: fields.viscosity.id,
          option_keys: ['5w-30'],
          ...owner,
        });

        expect(response.status).toBe(400);
      });

      it.each([
        ['a negative minimum', { min: -5 }],
        ['a negative maximum', { max: -1 }],
      ])('names the field for %s', async (_, bounds) => {
        const response = await post('/admin/requirements', {
          field_id: fields.volume.id,
          engine_id: b47.engine.id,
          ...bounds,
        });

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({
          code: 'INVALID_FIELD',
          field: Object.keys(bounds)[0],
        });
      });

      it('refuses an option the field does not have', async () => {
        const response = await post('/admin/requirements', {
          field_id: fields.viscosity.id,
          engine_id: b47.engine.id,
          option_keys: ['10w-60'],
        });

        expect(response.status).toBe(400);
        expect(response.data).toEqual(
          expect.objectContaining({
            message: expect.stringContaining('Unknown option 10w-60'),
          }),
        );
      });

      it('refuses a Requirement identical to one the owner has', async () => {
        const response = await post('/admin/requirements', {
          field_id: fields.approvals.id,
          engine_id: om654.engine.id,
          option_keys: ['mb-229-52', 'mb-229-51'],
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'requirement',
        });
      });

      it('refuses a second Requirement on the same field of one owner', async () => {
        const response = await post('/admin/requirements', {
          field_id: fields.approvals.id,
          engine_id: om654.engine.id,
          option_keys: ['mb-229-51'],
        });

        expect(response.status).toBe(409);
        expect(response.data).toMatchObject({
          code: 'ALREADY_EXISTS',
          entity: 'requirement',
        });
      });

      it('lists and deletes the Requirements of an owner', async () => {
        const listed = (
          await api.get(
            `/admin/requirements?engine_id=${om654.engine.id}`,
            adminHeaders,
          )
        ).data.requirements;

        expect(listed).toEqual([
          expect.objectContaining({
            option_keys: ['mb-229-51', 'mb-229-52'],
            updated_by_user: expect.objectContaining({
              email: expect.any(String),
            }),
            field: expect.objectContaining({
              key: 'approvals',
              category: expect.objectContaining({ id: oil.id }),
            }),
          }),
        ]);

        expect(
          (await remove(`/admin/requirements/${listed[0].id}`)).status,
        ).toBe(200);
        expect(await requirementsOf(om654.vehicle.id)).toEqual([]);
      });

      it('refuses to delete a field or an option a Requirement uses', async () => {
        const base = `/admin/categories/${oil.id}/fields`;
        const option = (
          await post(`${base}/${fields.approvals.id}/options`, {
            key: 'acea-c3',
            label: 'ACEA C3',
          })
        ).data.option;
        const capacity = (
          await post(base, {
            key: 'capacity',
            type: 'number',
            label: 'Емкость',
          })
        ).data.field;
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: '8C33',
        });
        await post('/admin/requirements', {
          field_id: fields.approvals.id,
          vehicle_id: vehicle.id,
          option_keys: ['acea-c3'],
        });
        await post('/admin/requirements', {
          field_id: capacity.id,
          vehicle_id: vehicle.id,
          max: 6,
        });

        expect(
          (await remove(`${base}/${fields.approvals.id}/options/${option.id}`))
            .status,
        ).toBe(400);
        expect((await remove(`${base}/${capacity.id}`)).status).toBe(400);
      });
    });
  },
});
