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
    describe('Requirements and the maintenance kit', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;

      const post = (path: string, body: unknown): Promise<Response> =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const remove = (path: string): Promise<Response> =>
        api.delete(path, adminHeaders).catch((error) => error.response);
      const vehicleParts = async (id: string) =>
        (await api.get(`/store/vehicles/${id}/parts`, storeHeaders)).data;

      let oil: Row;
      let filter: Row;
      let fields: Record<string, Row>;
      let b47: Awaited<ReturnType<typeof createVehicleFixture>>;
      let om654: Awaited<ReturnType<typeof createVehicleFixture>>;
      let goodOil: string;

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
        filter = (
          await post('/admin/categories', {
            slug: 'oil-filter',
            name: 'Масляный фильтр',
            maintenance_kit: true,
            kit_rank: 1,
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

        goodOil = await catalog.createPartWithIdentifiers({
          name: 'Масло 5W-30 LL-04 229.51',
          identifiers: [],
          category_id: oil.id,
          attributes: {
            approvals: ['bmw-ll-04', 'mb-229-51'],
            viscosity: '5w-30',
            volume: 5,
          },
        });
        await catalog.createPartWithIdentifiers({
          name: 'Масло 5W-30 VW',
          identifiers: [],
          category_id: oil.id,
          attributes: { approvals: ['vw-504-00'], viscosity: '5w-30' },
        });

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

      it('matches an oil with approvals {bmw-ll-04, mb-229-51} to a B47 and an OM654 Requirement', async () => {
        const name = 'Масло 5W-30 LL-04 229.51';

        expect((await vehicleParts(b47.vehicle.id)).matches).toEqual([
          {
            category_id: oil.id,
            quantity: 5,
            parts: [{ id: goodOil, name, category_id: oil.id }],
          },
        ]);
        expect((await vehicleParts(om654.vehicle.id)).matches).toEqual([
          {
            category_id: oil.id,
            quantity: 1,
            parts: [{ id: goodOil, name, category_id: oil.id }],
          },
        ]);
      });

      it('gives a Vehicle the Requirements of its Engine and Chassis', async () => {
        const { vehicles } = (await api.get('/store/vehicles', storeHeaders))
          .data;
        const requirements = vehicles.find(
          ({ id }: { id: string }) => id === b47.vehicle.id,
        ).requirements;

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

      it('holds one Part per flagged Category in the kit, with quantities', async () => {
        const oilFilter = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр B47',
          identifiers: [],
          category_id: filter.id,
        });
        await catalog.createFitments({
          part_id: oilFilter,
          vehicle_id: b47.vehicle.id,
        });

        expect((await vehicleParts(b47.vehicle.id)).kit).toEqual([
          { category_id: filter.id, part_id: oilFilter, quantity: 1 },
          { category_id: oil.id, part_id: goodOil, quantity: 5 },
        ]);
        expect((await vehicleParts(om654.vehicle.id)).kit).toEqual([
          { category_id: oil.id, part_id: goodOil, quantity: 1 },
        ]);
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
        expect((await vehicleParts(vehicle.vehicle.id)).matches).toEqual([]);
        expect((await vehicleParts(b47.vehicle.id)).matches).toHaveLength(1);
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
        expect((await vehicleParts(om654.vehicle.id)).matches).toEqual([]);
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
