import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

import { buildOrderEmail } from '../../lib/order-email';
import orderPlacedEmail, { config } from '../order-placed-email';

const ORDER = {
  id: 'order_1',
  display_id: 7,
  email: 'kupac@example.com',
  locale: 'en-US',
  total: 12690,
  items: [
    {
      product_title: 'Bosch S4 024',
      title: 'Default',
      quantity: 1,
      total: 11190,
    },
    {
      product_title: null,
      title: 'Battery installation',
      quantity: 1,
      total: 1500,
    },
  ],
};

const containerFor = (order: unknown) => {
  const createNotifications = jest.fn().mockResolvedValue([]);
  const logger = { info: jest.fn() };
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest.fn().mockResolvedValue({ data: order ? [order] : [] }),
    },
    [ContainerRegistrationKeys.LOGGER]: logger,
    [Modules.NOTIFICATION]: { createNotifications },
  };
  return {
    createNotifications,
    logger,
    container: { resolve: (key: string) => services[key] },
  };
};

const fire = (container: object) =>
  orderPlacedEmail({
    event: { name: 'order.placed', data: { id: 'order_1' } },
    container,
  } as never);

describe('the order-placed email subscriber', () => {
  it('emails the customer in the language the order was placed in, once per order', async () => {
    const { container, createNotifications } = containerFor(ORDER);

    await fire(container);

    expect(createNotifications).toHaveBeenCalledWith({
      to: 'kupac@example.com',
      channel: 'email',
      template: 'order-placed',
      content: buildOrderEmail({
        displayId: 7,
        locale: 'en',
        items: [
          { title: 'Bosch S4 024', quantity: 1, total: 11190 },
          { title: 'Battery installation', quantity: 1, total: 1500 },
        ],
        total: 12690,
      }),
      trigger_type: 'order.placed',
      resource_id: 'order_1',
      resource_type: 'order',
      idempotency_key: 'order-placed:order_1',
    });
  });

  it('skips empty lines and survives a line without any title', async () => {
    const { container, createNotifications } = containerFor({
      ...ORDER,
      items: [
        null,
        { product_title: null, title: null, quantity: '1', total: '1500' },
      ],
    });

    await fire(container);

    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        content: buildOrderEmail({
          displayId: 7,
          locale: 'en',
          items: [{ title: '', quantity: 1, total: 1500 }],
          total: 12690,
        }),
      }),
    );
  });

  it('sends a confirmation even when the order lines are missing', async () => {
    const { container, createNotifications } = containerFor({
      ...ORDER,
      items: null,
    });

    await fire(container);

    expect(createNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        content: buildOrderEmail({
          displayId: 7,
          locale: 'en',
          items: [],
          total: 12690,
        }),
      }),
    );
  });

  it('skips an order it cannot reach by email', async () => {
    const { container, createNotifications, logger } = containerFor({
      ...ORDER,
      email: null,
    });

    await fire(container);

    expect(createNotifications).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('order_1'),
    );
  });

  it('lets a failed send fail the subscriber, so the bus retries it', async () => {
    const { container, createNotifications } = containerFor(ORDER);
    createNotifications.mockRejectedValueOnce(
      new Error('Brevo refused the message: HTTP 500'),
    );

    await expect(fire(container)).rejects.toThrow('HTTP 500');
  });

  it('listens to order.placed', () => {
    expect(config.event).toBe('order.placed');
  });
});
