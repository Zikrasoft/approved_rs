import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  createProductsWorkflow,
  updateProductsWorkflow,
} from '@medusajs/medusa/core-flows';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { DEFAULT_OPTION, SHOP } from '../../src/lib/shop';
import type { VehicleTree } from '../../src/lib/vehicle-tree';
import { VEHICLE_MODULE } from '../../src/modules/vehicle/id';
import { seedBase } from '../../src/scripts/seed-base';
import { VEHICLES } from '../../src/scripts/vehicle-fixture';
import { adminHeaders } from './admin-session';

jest.setTimeout(180_000);

const generationCount = (tree: VehicleTree): number =>
  tree.flatMap((make) => make.models.flatMap((model) => model.generations))
    .length;

const find = (tree: VehicleTree, name: string) =>
  tree.find((make) => make.name === name);

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    beforeAll(() =>
      seedBase(
        getContainer(),
        getContainer().resolve(ContainerRegistrationKeys.LOGGER),
      ),
    );

    const admin = async () => ({
      headers: await adminHeaders(api, getContainer),
    });

    it('serves the seeded dictionary as one tree, and only to an admin', async () => {
      const { data } = await api.get('/admin/vehicles', await admin());

      expect(data.makes.map((make: { name: string }) => make.name)).toEqual(
        expect.arrayContaining(VEHICLES.map((make) => make.name)),
      );
      expect(generationCount(data.makes)).toBe(generationCount(VEHICLES));
      expect(data.makes[0]).toEqual({
        id: expect.stringMatching(/^vmake_/),
        name: expect.any(String),
        models: expect.any(Array),
      });

      const anonymous = await api
        .get('/admin/vehicles')
        .catch((failure) => failure.response);
      expect(anonymous.status).toBe(401);
    });

    it('edits the dictionary and refuses what would strand a product', async () => {
      const headers = await admin();
      const post = (path: string, body: object) =>
        api.post(path, body, headers);

      const created = await post('/admin/vehicles/makes', { name: 'Zikra' });
      expect(created.status).toBe(201);
      const make = find(created.data.makes, 'Zikra')!;

      const { data: withModel } = await post('/admin/vehicles/models', {
        make_id: make.id,
        name: 'Proto',
      });
      const [model] = find(withModel.makes, 'Zikra')!.models;

      const { data: withGeneration } = await post(
        '/admin/vehicles/generations',
        {
          vehicle_model_id: model.id,
          name: 'I',
          yearFrom: 2010,
          yearTo: 2015,
        },
      );
      const [generation] = find(withGeneration.makes, 'Zikra')!.models[0]
        .generations;
      expect(generation).toEqual({
        id: expect.any(String),
        name: 'I',
        yearFrom: 2010,
        yearTo: 2015,
      });

      const twice = await post('/admin/vehicles/makes', {
        name: 'Zikra',
      }).catch((failure) => failure.response);
      expect(twice.status).toBe(400);
      expect(twice.data.message).toBe(
        'Справочник не сохранён: марка «Zikra» записана дважды',
      );

      const reversed = await post('/admin/vehicles/generations', {
        vehicle_model_id: model.id,
        name: 'II',
        yearFrom: 2020,
        yearTo: 2013,
      }).catch((failure) => failure.response);
      expect(reversed.status).toBe(400);
      expect(reversed.data.message).toContain('год начала позже года конца');

      const overlapping = await post('/admin/vehicles/generations', {
        vehicle_model_id: model.id,
        name: 'II',
        yearFrom: 2013,
        yearTo: 2020,
      });
      expect(overlapping.status).toBe(201);

      const {
        result: [product],
      } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: 'Varta для справочника',
              metadata: {
                fitment: [
                  {
                    make: 'Zikra',
                    model: 'Proto',
                    yearFrom: 2011,
                    yearTo: 2014,
                  },
                ],
              },
              options: [{ title: DEFAULT_OPTION, values: [DEFAULT_OPTION] }],
              variants: [
                {
                  title: DEFAULT_OPTION,
                  manage_inventory: false,
                  options: { [DEFAULT_OPTION]: DEFAULT_OPTION },
                  prices: [{ currency_code: SHOP.currency, amount: 1000 }],
                },
              ],
            },
          ],
        },
      });

      const strandingEdits = [
        () => api.delete(`/admin/vehicles/makes/${make.id}`, headers),
        () =>
          post(`/admin/vehicles/makes/${make.id}`, { name: 'Zikra Motors' }),
        () => post(`/admin/vehicles/models/${model.id}`, { name: 'Proto X' }),
        () =>
          post(`/admin/vehicles/generations/${generation.id}`, {
            yearFrom: 2012,
          }),
        () =>
          api.delete(`/admin/vehicles/generations/${generation.id}`, headers),
      ];
      for (const edit of strandingEdits) {
        const answer = await edit().catch((failure) => failure.response);
        expect(answer.status).toBe(409);
        expect(answer.data.message).toContain('Varta для справочника');
      }

      const widened = await post(
        `/admin/vehicles/generations/${generation.id}`,
        { yearTo: 2016 },
      );
      expect(
        find(widened.data.makes, 'Zikra')!.models[0].generations[0].yearTo,
      ).toBe(2016);

      await updateProductsWorkflow(getContainer()).run({
        input: {
          selector: { id: product.id },
          update: { metadata: { fitment: [] } },
        },
      });

      const deleted = await api.delete(
        `/admin/vehicles/makes/${make.id}`,
        headers,
      );
      expect(deleted.status).toBe(200);
      expect(find(deleted.data.makes, 'Zikra')).toBeUndefined();

      const vehicles = getContainer().resolve(VEHICLE_MODULE) as {
        listVehicleModels(filters: object): Promise<unknown[]>;
        listVehicleGenerations(filters: object): Promise<unknown[]>;
      };
      expect(await vehicles.listVehicleModels({ id: model.id })).toEqual([]);
      expect(
        await vehicles.listVehicleGenerations({ id: generation.id }),
      ).toEqual([]);
    });
  },
});
