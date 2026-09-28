import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { productSource, sourceHash } from '../../lib/product-source';
import { translateProduct } from '../../lib/translate-product';
import translateBacklog, { BACKLOG_BATCH, config } from '../translate-backlog';

jest.mock('../../lib/translate-product', () => ({
  ...jest.requireActual('../../lib/translate-product'),
  translateProduct: jest.fn(),
}));

const stale = (id: string) => ({ id, title: `Товар ${id}`, metadata: {} });
const current = (id: string) => {
  const row = { id, title: `Товар ${id}` };
  return {
    ...row,
    metadata: { translated_from: sourceHash(productSource(row)) },
  };
};

const containerFor = (rows: unknown[]) => {
  const graph = jest.fn().mockResolvedValue({ data: rows });
  const logger = { info: jest.fn() };
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

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = 'sk-test';
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('translate-backlog', () => {
  it('retries only the products whose Russian moved since their last translation', async () => {
    const { container, logger } = containerFor([
      current('a'),
      stale('b'),
      stale('c'),
    ]);

    await translateBacklog(container);

    expect(
      (translateProduct as jest.Mock).mock.calls.map(([, id]) => id),
    ).toEqual(['b', 'c']);
    expect(logger.info).toHaveBeenCalledWith(
      'Translation backlog: 2 product(s) retried',
    );
  });

  it('reads every product type, installation services included', async () => {
    const { container, graph } = containerFor([stale('a')]);

    await translateBacklog(container);

    expect(graph.mock.calls[0][0]).toMatchObject({ entity: 'product' });
    expect(graph.mock.calls[0][0]).not.toHaveProperty('filters');
  });

  it('caps a run so a broken key cannot spend the whole night', async () => {
    const rows = Array.from({ length: BACKLOG_BATCH + 10 }, (_, index) =>
      stale(`p${index}`),
    );
    const { container } = containerFor(rows);

    await translateBacklog(container);

    expect(translateProduct).toHaveBeenCalledTimes(BACKLOG_BATCH);
  });

  it('does not even read the catalogue without a key', async () => {
    delete process.env.OPENAI_API_KEY;
    const { container, graph } = containerFor([stale('a')]);

    await translateBacklog(container);

    expect(graph).not.toHaveBeenCalled();
    expect(translateProduct).not.toHaveBeenCalled();
  });

  it('runs every hour', () => {
    expect(config).toEqual({
      name: 'translate-backlog',
      schedule: '0 * * * *',
    });
  });
});
