import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { cancelOrderWorkflow } from '@medusajs/medusa/core-flows';

import { RESERVE_DAYS } from '../../lib/shop';
import releaseUncollected, { config } from '../release-uncollected';

jest.mock('@medusajs/medusa/core-flows', () => ({
  cancelOrderWorkflow: jest.fn(),
}));

const run = jest.fn().mockResolvedValue({});

const containerFor = (rows: unknown[]) => {
  const graph = jest.fn().mockResolvedValue({ data: rows });
  const logger = { info: jest.fn(), error: jest.fn() };
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: { graph },
    [ContainerRegistrationKeys.LOGGER]: logger,
  };
  return {
    graph,
    logger,
    container: { resolve: (key: string) => services[key] } as never,
  };
};

const EMPTY = { fulfillments: [], payment_collections: [] };

const cancelled = () =>
  (run.mock.calls as [{ input: { order_id: string } }][]).map(
    ([call]) => call.input.order_id,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (cancelOrderWorkflow as unknown as jest.Mock).mockReturnValue({ run });
});

describe('release-uncollected', () => {
  it('leaves an order inside the window alone by never asking for it', async () => {
    const { container, graph, logger } = containerFor([]);
    const window = RESERVE_DAYS * 24 * 60 * 60 * 1000;
    const before = Date.now();

    await releaseUncollected(container);

    const after = Date.now();
    const { filters } = graph.mock.calls[0][0];
    expect(filters.status).toBe('pending');
    const cutoff = Date.parse(filters.created_at.$lt);
    expect(cutoff).toBeGreaterThanOrEqual(before - window);
    expect(cutoff).toBeLessThanOrEqual(after - window);
    expect(run).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('cancels an order the query returned as past the window', async () => {
    const { container, logger } = containerFor([{ id: 'order_1', ...EMPTY }]);

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['order_1']);
    expect(logger.info).toHaveBeenCalledWith(
      'Uncollected orders: 1 of 1 cancelled',
    );
  });

  it('skips a fulfilled order and keeps a cancelled fulfillment cancellable', async () => {
    const { container } = containerFor([
      {
        id: 'fulfilled',
        fulfillments: [{ canceled_at: null }],
        payment_collections: [],
      },
      {
        id: 'refulfilled',
        fulfillments: [{ canceled_at: '2026-09-01T00:00:00.000Z' }],
        payment_collections: [],
      },
    ]);

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['refulfilled']);
  });

  it('says how many of the aged orders it let go, even when that is none', async () => {
    const { container, logger } = containerFor([
      {
        id: 'fulfilled',
        fulfillments: [{ canceled_at: null }],
        payment_collections: [],
      },
    ]);

    await releaseUncollected(container);

    expect(run).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Uncollected orders: 0 of 1 cancelled',
    );
  });

  it('skips an order whose payment was already captured', async () => {
    const { container } = containerFor([
      {
        id: 'paid',
        fulfillments: [],
        payment_collections: [{ captured_amount: 11190 }],
      },
      {
        id: 'unpaid',
        fulfillments: [],
        payment_collections: [{ captured_amount: null }],
      },
    ]);

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['unpaid']);
  });

  it('logs an unreadable captured amount and still reaches the next order', async () => {
    const { container, logger } = containerFor([
      {
        id: 'unreadable',
        fulfillments: [],
        payment_collections: [{ captured_amount: 'about a tenner' }],
      },
      { id: 'fine', ...EMPTY },
    ]);

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['fine']);
    expect(logger.error).toHaveBeenCalledWith(
      'Uncollected order unreadable refused cancellation',
      expect.any(Error),
    );
  });

  it('logs an order that refuses cancellation, even without an Error, and cancels the rest anyway', async () => {
    const { container, logger } = containerFor([
      { id: 'stuck', ...EMPTY },
      { id: 'fine', ...EMPTY },
    ]);
    run.mockRejectedValueOnce('has a fulfillment');

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['stuck', 'fine']);
    expect(logger.error).toHaveBeenCalledWith(
      'Uncollected order stuck refused cancellation',
      expect.any(Error),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Uncollected orders: 1 of 2 cancelled',
    );
  });

  it('refuses to guess at an order whose relations the query did not return', async () => {
    const { container, logger } = containerFor([
      { id: 'shapeless' },
      { id: 'fine', ...EMPTY },
    ]);

    await releaseUncollected(container);

    expect(cancelled()).toEqual(['fine']);
    expect(logger.error).toHaveBeenCalledWith(
      'Uncollected order shapeless refused cancellation',
      expect.any(Error),
    );
  });

  it('runs every hour', () => {
    expect(config).toEqual({
      name: 'release-uncollected',
      schedule: '0 * * * *',
    });
  });
});
