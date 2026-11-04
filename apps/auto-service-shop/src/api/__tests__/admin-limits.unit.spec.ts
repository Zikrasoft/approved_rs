import { parseAdminBody } from '../../lib/admin-errors';
import {
  AdminAddPartIdentifier,
  AdminCreateCategory,
  AdminCreateFitment,
  AdminCreateRequirement,
  AdminOrderImages,
  AdminUpdateCategoryField,
} from '../admin/validators';
import { VEHICLE_REFERENCE_BODIES } from '../admin/vehicle-validators';

const bodyFor = (path: string) => {
  const found = VEHICLE_REFERENCE_BODIES.find(([route]) => route === path);
  if (!found) throw new Error(path);
  return found;
};

const refusal = async (
  schema: Parameters<typeof parseAdminBody>[0],
  body: unknown,
) =>
  parseAdminBody(schema, body).then(
    () => null,
    (error: { code: string; details: Record<string, unknown> }) => ({
      code: error.code,
      ...error.details,
    }),
  );

const number = (type: string, value: string) => ({
  type,
  brand_id: 'brand_1',
  value,
});

describe('admin body limits', () => {
  it('refuses an image order longer than 200 ids', async () => {
    const ids = (count: number) =>
      Array.from({ length: count }, (_, index) => `img_${index}`);

    expect(await refusal(AdminOrderImages, { ids: ids(200) })).toBeNull();
    expect(await refusal(AdminOrderImages, { ids: ids(201) })).toEqual({
      code: 'INVALID_FIELD',
      field: 'ids',
    });
  });

  it.each(['4006381333931', '96385074', '4006 3813 3393 1'])(
    'accepts the valid EAN %j',
    async (value) => {
      expect(
        await refusal(AdminAddPartIdentifier, number('ean', value)),
      ).toBeNull();
    },
  );

  it.each(['4006381333932', '12345', 'ABCDEFGH', '400638133393'])(
    'refuses %j as an EAN, naming the ean field',
    async (value) => {
      expect(
        await refusal(AdminAddPartIdentifier, number('ean', value)),
      ).toEqual({
        code: 'INVALID_FIELD',
        field: 'ean',
      });
    },
  );

  it('refuses a part number longer than 50 characters', async () => {
    expect(
      await refusal(AdminAddPartIdentifier, number('oem', 'A'.repeat(51))),
    ).toEqual({ code: 'INVALID_FIELD', field: 'value' });
    expect(
      await refusal(AdminAddPartIdentifier, number('oem', 'A'.repeat(50))),
    ).toBeNull();
  });

  it.each([
    [
      AdminCreateCategory,
      { slug: 'oil', name: 'Oil', service_price: 99999999999 },
      'service_price',
    ],
    [
      AdminCreateCategory,
      { slug: 'oil', name: 'Oil', kit_rank: 2 ** 31 },
      'kit_rank',
    ],
    [AdminUpdateCategoryField, { rank: 2 ** 31 }, 'rank'],
    [
      AdminCreateFitment,
      { part_id: 'p', vehicle_id: 'v', quantity: 101 },
      'quantity',
    ],
    [
      AdminCreateRequirement,
      { field_id: 'f', engine_id: 'e', min: 1, quantity: 101 },
      'quantity',
    ],
    [bodyFor('/admin/vehicles')[2], { power_kw: 2001 }, 'power_kw'],
    [
      bodyFor('/admin/engines')[2],
      { displacement_cc: 20001 },
      'displacement_cc',
    ],
  ] as const)(
    'refuses an out-of-range integer (%#)',
    async (schema, body, field) => {
      expect(await refusal(schema, body)).toEqual({
        code: 'INVALID_FIELD',
        field,
      });
    },
  );

  it('stores the vehicle market in upper case so eu and EU are one market', async () => {
    const [, create] = bodyFor('/admin/vehicles');
    await expect(
      parseAdminBody(create, { model_id: 'm', engine_id: 'e', market: ' eu ' }),
    ).resolves.toMatchObject({ market: 'EU' });
  });

  it('names the make before its slug when both are missing', async () => {
    expect(await refusal(bodyFor('/admin/makes')[1], {})).toEqual({
      code: 'FIELD_REQUIRED',
      field: 'name',
    });
  });
});
