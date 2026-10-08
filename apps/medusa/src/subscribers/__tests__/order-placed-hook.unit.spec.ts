import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { sendOrderHook } from '../../lib/order-hook';
import orderPlacedHook, { config } from '../order-placed-hook';

jest.mock('../../lib/order-hook', () => ({
  ...jest.requireActual('../../lib/order-hook'),
  sendOrderHook: jest.fn(),
}));

const SECRET = 's'.repeat(32);

const ORDER = {
  id: 'order_1',
  display_id: 7,
  email: 'kupac@example.com',
  locale: 'ru-RU',
  total: 11190,
  metadata: null,
  shipping_address: { first_name: 'Marko', phone: '+381601234567' },
  items: [
    {
      product_id: 'prod_bat',
      product_title: 'Bosch S4 024',
      quantity: 1,
      unit_price: 11190,
    },
  ],
};

const PRODUCTS = [
  { id: 'prod_bat', title: 'Bosch S4 024', type: { value: 'batteries' } },
];

const containerFor = (
  orders: unknown[] = [ORDER],
  products: unknown[] = PRODUCTS,
) => {
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data: entity === 'order' ? orders : products,
  }));
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [ContainerRegistrationKeys.LOGGER]: logger,
  };
  return {
    graph,
    logger,
    container: { resolve: (key: string) => services[key] },
  };
};

const fire = (container: object) =>
  orderPlacedHook({
    event: { name: 'order.placed', data: { id: 'order_1' } },
    container,
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SHOP_ORDER_HOOK_URL = 'https://carlab.rs/api/shop-order';
  process.env.SHOP_ORDER_HOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.SHOP_ORDER_HOOK_URL;
  delete process.env.SHOP_ORDER_HOOK_SECRET;
});

describe('the order-placed hook subscriber', () => {
  it('sends nothing when the hook is not configured', async () => {
    delete process.env.SHOP_ORDER_HOOK_URL;
    delete process.env.SHOP_ORDER_HOOK_SECRET;
    const { container, graph, logger } = containerFor();

    await fire(container);

    expect(sendOrderHook).not.toHaveBeenCalled();
    expect(graph).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SHOP_ORDER_HOOK_URL'),
    );
  });

  it('posts the order card to the storefront hook', async () => {
    const { container, graph } = containerFor();

    await fire(container);

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'product',
        filters: { id: ['prod_bat'] },
      }),
    );
    expect(sendOrderHook).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        displayId: 7,
        locale: 'ru',
        adminUrl: 'https://api.carlab.rs/app/orders/order_1',
      }),
      { url: 'https://carlab.rs/api/shop-order', secret: SECRET },
    );
  });

  it('lets a failed post fail the subscriber, so the bus retries it', async () => {
    (sendOrderHook as jest.Mock).mockRejectedValueOnce(
      new Error('Order hook answered 502'),
    );
    const { container } = containerFor();

    await expect(fire(container)).rejects.toThrow('Order hook answered 502');
  });

  it('asks only for the products the order lines point to', async () => {
    const { container, graph } = containerFor([
      {
        ...ORDER,
        items: [
          null,
          {
            product_id: null,
            product_title: 'Ugradnja',
            quantity: 1,
            unit_price: 0,
          },
          ...ORDER.items,
          ...ORDER.items,
        ],
      },
    ]);

    await fire(container);

    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'product',
        filters: { id: ['prod_bat'] },
      }),
    );
  });

  it('logs an order the card contract refuses by id only and does not retry it', async () => {
    const { container, logger } = containerFor([
      {
        ...ORDER,
        shipping_address: { first_name: 'Marko', phone: '0601234567' },
      },
    ]);

    await fire(container);

    expect(sendOrderHook).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [message] = logger.error.mock.calls[0];
    expect(message).toContain('order_1');
    expect(message).toContain('customer.phone');
    expect(message).not.toContain('0601234567');
    expect(message).not.toContain('Marko');
  });

  it('still fails on anything that is not a contract refusal', async () => {
    const { container } = containerFor([{ ...ORDER, total: 'abc' }]);

    await expect(fire(container)).rejects.toThrow(
      'order order_1 does not fit its read: total:',
    );
    expect(sendOrderHook).not.toHaveBeenCalled();
  });

  it('fails on a product row its read cannot parse, so the bus retries it', async () => {
    const { container } = containerFor([ORDER], [null]);

    await expect(fire(container)).rejects.toThrow(
      'product (no id) does not fit its read',
    );
    expect(sendOrderHook).not.toHaveBeenCalled();
  });

  it('fails loudly for an order it cannot find', async () => {
    const { container } = containerFor([]);

    await expect(fire(container)).rejects.toThrow('order_1');
  });

  it('listens to order.placed', () => {
    expect(config.event).toBe('order.placed');
  });
});
