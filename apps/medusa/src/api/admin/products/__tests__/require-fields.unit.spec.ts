import { fillProductDefaults, handleFor } from '../require-fields';

type Rows = Record<string, unknown[]>;

const SHOP_ROWS: Rows = {
  shipping_profile: [{ id: 'sp_default' }],
  sales_channel: [{ id: 'sc_carlab' }],
};

const scopeWith = (rows: Rows) => ({
  resolve: () => ({
    graph: jest.fn(async ({ entity }: { entity: string }) => ({
      data: rows[entity] ?? [],
    })),
  }),
});

const fill = async (body: Record<string, unknown>, rows: Rows = SHOP_ROWS) => {
  const req = { validatedBody: { ...body }, body, scope: scopeWith(rows) };
  const next = jest.fn();
  await fillProductDefaults(req as never, {} as never, next);
  return { req, next };
};

describe('handleFor', () => {
  it.each([
    [{ title: 'Аккумулятор тест' }, 'akkumulyator-test'],
    [{ title: 'Varta Blue Dynamic E12' }, 'varta-blue-dynamic-e12'],
    [{ title: 'Что угодно', handle: 'аккумулятор' }, 'akkumulyator'],
  ])('spells %j as %s', (draft, handle) => {
    expect(handleFor(draft)).toBe(handle);
  });

  it('keeps a Latin handle the owner typed', () => {
    expect(
      handleFor({ title: 'Аккумулятор', handle: 'my-battery' }),
    ).toBeNull();
  });

  it('gives up on a title of punctuation only', () => {
    expect(handleFor({ title: '«»' })).toBeNull();
  });
});

describe('fillProductDefaults', () => {
  it('writes the Latin handle into both bodies the route may read', async () => {
    const { req, next } = await fill({ title: 'Аккумулятор тест' });

    expect(req.validatedBody.handle).toBe('akkumulyator-test');
    expect(req.body.handle).toBe('akkumulyator-test');
    expect(next).toHaveBeenCalledWith();
  });

  it('attaches the default shipping profile and the carlab.rs channel', async () => {
    const { req } = await fill({ title: 'Varta' });

    expect(req.validatedBody).toMatchObject({
      shipping_profile_id: 'sp_default',
      sales_channels: [{ id: 'sc_carlab' }],
    });
    expect(req.body).toMatchObject({
      shipping_profile_id: 'sp_default',
      sales_channels: [{ id: 'sc_carlab' }],
    });
  });

  it('keeps a profile and a channel the owner chose', async () => {
    const { req } = await fill({
      title: 'Varta',
      shipping_profile_id: 'sp_other',
      sales_channels: [{ id: 'sc_other' }],
    });

    expect(req.validatedBody).toMatchObject({
      shipping_profile_id: 'sp_other',
      sales_channels: [{ id: 'sc_other' }],
    });
  });

  it('leaves the defaults out while the shop has none', async () => {
    const { req } = await fill({ title: 'Varta' }, {});

    expect(req.validatedBody).not.toHaveProperty('shipping_profile_id');
    expect(req.validatedBody).not.toHaveProperty('sales_channels');
  });

  it('skips a body that is not an object', async () => {
    const req = {
      validatedBody: { title: 'Аккумулятор' },
      body: undefined,
      scope: scopeWith(SHOP_ROWS),
    };
    const next = jest.fn();

    await fillProductDefaults(req as never, {} as never, next);

    expect(req.validatedBody).toMatchObject({ handle: 'akkumulyator' });
    expect(next).toHaveBeenCalledWith();
  });

  it('hands a failing lookup to Medusa instead of throwing', async () => {
    const failure = new Error('db down');
    const req = {
      validatedBody: { title: 'Varta' },
      body: { title: 'Varta' },
      scope: {
        resolve: () => ({ graph: jest.fn().mockRejectedValue(failure) }),
      },
    };
    const next = jest.fn();

    await fillProductDefaults(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
