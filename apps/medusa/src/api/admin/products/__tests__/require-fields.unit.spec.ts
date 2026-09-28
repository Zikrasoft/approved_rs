import {
  fillProductDefaults,
  handleFor,
  refuseGuardedBatchEdits,
  refuseProductImports,
  requireReadyToPublish,
  requireValidSpec,
} from '../require-fields';

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

const SPEC = {
  brand: 'Bosch',
  capacityAh: 60,
  crankingA: 540,
  polarity: 'left',
  lengthMm: 242,
  widthMm: 175,
  heightMm: 175,
  warrantyMonths: 24,
};

type Guard = typeof requireValidSpec;

const guard = async (
  middleware: Guard,
  body: Record<string, unknown>,
  rows: Rows,
  id?: string,
) => {
  const req = {
    validatedBody: body,
    body,
    params: id ? { id } : {},
    scope: scopeWith(rows),
  };
  const next = jest.fn();
  await middleware(req as never, {} as never, next);
  const [error] = next.mock.calls[0];
  return error as { type: string; message: string } | undefined;
};

const BATTERY_TYPE: Rows = { product_type: [{ value: 'batteries' }] };
const SERVICE: Rows = { product_type: [{ value: 'services' }] };
const FILTER_TYPE: Rows = { product_type: [{ value: 'filters' }] };

const PRICED = [
  { title: 'Default', prices: [{ currency_code: 'rsd', amount: 12000 }] },
];

describe('requireValidSpec', () => {
  it('lets through an edit that does not touch the spec', async () => {
    expect(
      await guard(requireValidSpec, { title: 'Varta' }, {}),
    ).toBeUndefined();
  });

  it('refuses a spec that breaks the registry, naming the field, in Russian', async () => {
    const error = await guard(
      requireValidSpec,
      {
        type_id: 'ptyp_bat',
        metadata: { spec: { ...SPEC, capacityAh: 'sixty' } },
      },
      BATTERY_TYPE,
    );

    expect(error?.type).toBe('invalid_data');
    expect(error?.message).toMatch(/^Характеристики товара не сходятся: /);
    expect(error?.message).toContain('capacityAh');
  });

  it('checks an edit against the stored type and the stored metadata', async () => {
    const error = await guard(
      requireValidSpec,
      { metadata: { spec: { ...SPEC, polarity: 'up' } } },
      {
        product: [
          {
            status: 'draft',
            metadata: { fitment: [] },
            type: { value: 'batteries' },
          },
        ],
      },
      'prod_1',
    );

    expect(error?.message).toContain('polarity');
  });

  it('refuses a spec on a product with no type', async () => {
    const error = await guard(
      requireValidSpec,
      { metadata: { spec: SPEC } },
      {},
    );

    expect(error?.message).toMatch(/^Характеристики товара не сходятся: /);
  });

  it('leaves a service alone', async () => {
    expect(
      await guard(
        requireValidSpec,
        { type_id: 'ptyp_svc', metadata: { spec: { anything: true } } },
        SERVICE,
      ),
    ).toBeUndefined();
  });
});

describe('requireReadyToPublish', () => {
  it('lets a draft through whatever its spec', async () => {
    expect(
      await guard(
        requireReadyToPublish,
        { status: 'draft', type_id: 'ptyp_bat' },
        BATTERY_TYPE,
      ),
    ).toBeUndefined();
  });

  it('refuses to publish a product with no type', async () => {
    const error = await guard(
      requireReadyToPublish,
      { status: 'published' },
      {},
    );

    expect(error?.message).toBe(
      'Товар не выпустить на сайт: не выбран тип товара',
    );
  });

  it('refuses to publish a battery without its spec', async () => {
    const error = await guard(
      requireReadyToPublish,
      { status: 'published', type_id: 'ptyp_bat' },
      BATTERY_TYPE,
    );

    expect(error?.message).toMatch(/^Товар не выпустить на сайт: /);
  });

  it('publishes a battery whose spec fits', async () => {
    expect(
      await guard(
        requireReadyToPublish,
        {
          status: 'published',
          type_id: 'ptyp_bat',
          metadata: { spec: SPEC },
          variants: PRICED,
        },
        BATTERY_TYPE,
      ),
    ).toBeUndefined();
  });

  it('re-checks a published product on every edit', async () => {
    const error = await guard(
      requireReadyToPublish,
      { title: 'Новое имя' },
      {
        product: [
          {
            status: 'published',
            metadata: { spec: { brand: 'Bosch' } },
            type: { value: 'batteries' },
          },
        ],
      },
      'prod_1',
    );

    expect(error?.message).toMatch(/^Товар не выпустить на сайт: /);
  });

  it('publishes a service without a spec', async () => {
    expect(
      await guard(
        requireReadyToPublish,
        { status: 'published', type_id: 'ptyp_svc', variants: PRICED },
        SERVICE,
      ),
    ).toBeUndefined();
  });

  it('hands a failing lookup to Medusa instead of throwing', async () => {
    const failure = new Error('db down');
    const req = {
      validatedBody: { status: 'published', type_id: 'ptyp_bat' },
      params: {},
      scope: {
        resolve: () => ({ graph: jest.fn().mockRejectedValue(failure) }),
      },
    };
    const next = jest.fn();

    await requireReadyToPublish(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('the single-product guards on the batch path', () => {
  it.each([
    ['requireValidSpec', requireValidSpec],
    ['requireReadyToPublish', requireReadyToPublish],
  ])(
    '%s leaves /admin/products/batch to its own guard',
    async (_name, middleware) => {
      expect(
        await guard(
          middleware,
          { status: 'published', metadata: { spec: {} } },
          {},
          'batch',
        ),
      ).toBeUndefined();
    },
  );
});

describe('the publish invariant', () => {
  const PUBLISHED_BATTERY: Rows = {
    product: [
      {
        status: 'published',
        metadata: { spec: SPEC },
        type: { value: 'batteries' },
        variants: PRICED,
      },
    ],
  };

  it('refuses to un-type a published product', async () => {
    const error = await guard(
      requireReadyToPublish,
      { type_id: null },
      PUBLISHED_BATTERY,
      'prod_1',
    );

    expect(error?.message).toBe(
      'Товар не выпустить на сайт: не выбран тип товара',
    );
  });

  it('checks a type change against the stored spec', async () => {
    const error = await guard(
      requireValidSpec,
      { type_id: 'ptyp_flt' },
      {
        ...FILTER_TYPE,
        product: [
          {
            status: 'draft',
            metadata: { spec: SPEC },
            type: { value: 'batteries' },
          },
        ],
      },
      'prod_1',
    );

    expect(error?.type).toBe('invalid_data');
    expect(error?.message).toMatch(/^Характеристики товара не сходятся: /);
    expect(error?.message).toContain('filterKind');
  });

  it('lets a type change through on a draft with no spec yet', async () => {
    expect(
      await guard(
        requireValidSpec,
        { type_id: 'ptyp_flt' },
        {
          ...FILTER_TYPE,
          product: [{ status: 'draft', metadata: null, type: null }],
        },
        'prod_1',
      ),
    ).toBeUndefined();
  });

  it('refuses to publish a variant with no dinar price', async () => {
    const error = await guard(
      requireReadyToPublish,
      {
        status: 'published',
        type_id: 'ptyp_bat',
        metadata: { spec: SPEC },
        variants: [
          { title: 'Default', prices: [{ currency_code: 'eur', amount: 100 }] },
        ],
      },
      BATTERY_TYPE,
    );

    expect(error?.type).toBe('invalid_data');
    expect(error?.message).toBe(
      'Товар не выпустить на сайт: у варианта «Default» нет цены в динарах',
    );
  });

  it('refuses to publish a service with no variants', async () => {
    const error = await guard(
      requireReadyToPublish,
      { status: 'published', type_id: 'ptyp_svc' },
      SERVICE,
    );

    expect(error?.message).toBe(
      'Товар не выпустить на сайт: нет ни одного варианта с ценой',
    );
  });

  it('checks the stored prices when the edit sends no variants', async () => {
    const error = await guard(
      requireReadyToPublish,
      { status: 'published' },
      {
        product: [
          {
            status: 'draft',
            metadata: { spec: SPEC },
            type: { value: 'batteries' },
            variants: [
              {
                title: 'Default',
                prices: [{ currency_code: 'rsd', amount: 0 }],
              },
            ],
          },
        ],
      },
      'prod_1',
    );

    expect(error?.message).toMatch(/нет цены в динарах/);
  });

  it('reads the stored prices of a sent variant that leaves them out', async () => {
    expect(
      await guard(
        requireReadyToPublish,
        { variants: [{ id: 'variant_1', title: 'Default' }] },
        {
          product: [
            {
              status: 'published',
              metadata: { spec: SPEC },
              type: { value: 'batteries' },
              variants: [{ id: 'variant_1', ...PRICED[0] }],
            },
          ],
        },
        'prod_1',
      ),
    ).toBeUndefined();
  });

  it('publishes a stored product whose variants carry a dinar price', async () => {
    expect(
      await guard(
        requireReadyToPublish,
        { title: 'Varta' },
        PUBLISHED_BATTERY,
        'prod_1',
      ),
    ).toBeUndefined();
  });
});

describe('refuseProductImports', () => {
  it('refuses a product import, in Russian', () => {
    const next = jest.fn();
    refuseProductImports({} as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'invalid_data',
        message:
          'Импорт товаров отключён — создавайте и меняйте товары в карточке',
      }),
    );
  });
});

describe('refuseGuardedBatchEdits', () => {
  const REFUSAL =
    'Характеристики, совместимость и публикацию меняйте в карточке товара';

  const batch = (body: Record<string, unknown>) => {
    const next = jest.fn();
    refuseGuardedBatchEdits(
      { validatedBody: body, body } as never,
      {} as never,
      next,
    );
    const [error] = next.mock.calls[0];
    return error as { type: string; message: string } | undefined;
  };

  it.each([
    ['a spec', { update: [{ id: 'prod_1', metadata: { spec: {} } }] }],
    ['a fitment', { create: [{ title: 'Varta', metadata: { fitment: [] } }] }],
    ['a product type', { update: [{ id: 'prod_1', type_id: 'ptyp_bat' }] }],
    ['a publication', { update: [{ id: 'prod_1', status: 'published' }] }],
  ])('refuses a batch that sets %s, in Russian', (_label, body) => {
    const error = batch(body);

    expect(error?.type).toBe('invalid_data');
    expect(error?.message).toBe(REFUSAL);
  });

  it('lets a price-only update through', () => {
    expect(
      batch({
        update: [
          {
            id: 'prod_1',
            variants: [
              {
                id: 'variant_1',
                prices: [{ currency_code: 'rsd', amount: 12000 }],
              },
            ],
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('lets a delete through', () => {
    expect(batch({ delete: ['prod_1'] })).toBeUndefined();
  });

  it('lets a title, another metadata key and a draft status through', () => {
    expect(
      batch({
        update: [
          {
            id: 'prod_1',
            title: 'Varta E12',
            status: 'draft',
            metadata: { note: 'x' },
          },
        ],
      }),
    ).toBeUndefined();
  });
});
