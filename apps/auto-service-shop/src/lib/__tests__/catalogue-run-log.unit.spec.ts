import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { holdCatalogueWriter } from '../catalogue-writer';

const runs = () =>
  (console.log as jest.Mock).mock.calls
    .map(([line]) => JSON.parse(line))
    .filter(({ event }) => event === 'catalogue.run');

const scopeWith = (update: jest.Mock) => {
  const logger = { error: jest.fn(), warn: jest.fn() };
  return {
    logger,
    scope: {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.LOGGER
          ? logger
          : { updateCatalogueRuns: update },
    } as never,
  };
};

const finished = (fields: Record<string, unknown> = {}) => ({
  id: 'run_1',
  kind: 'import',
  supplier_id: 'sup_1',
  status: 'succeeded',
  failed_step: null,
  error: null,
  report: null,
  created_at: '2026-11-01T10:00:00.000Z',
  finished_at: '2026-11-01T10:00:02.500Z',
  ...fields,
});

describe('a finished catalogue run', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is logged with its duration and the countable parts of its report', async () => {
    const update = jest.fn().mockResolvedValue([
      finished({
        report: {
          supplier: 'MANN',
          imported: 3,
          failed: [{ number: 'HU 816 x', reason: 'no answer' }],
          skipped_by_reason: { brand: 1 },
        },
      }),
    ]);

    await holdCatalogueWriter(scopeWith(update).scope, 'run_1', async () => 1);

    expect(runs()).toEqual([
      expect.objectContaining({
        outcome: 'succeeded',
        reason: null,
        kind: 'import',
        run: 'run_1',
        supplier: 'sup_1',
        duration_ms: 2500,
        cause: null,
        counts: { imported: 3, failed: 1 },
      }),
    ]);
  });

  it('names the step that failed, else an exception, with the cause capped', async () => {
    const update = jest
      .fn()
      .mockResolvedValueOnce([
        finished({
          status: 'failed',
          failed_step: 'deploy',
          error: 'HTTP 500',
        }),
      ])
      .mockResolvedValueOnce([
        finished({
          status: 'failed',
          error: 'x'.repeat(900),
          created_at: new Date(Date.now() - 1000).toISOString(),
          finished_at: null,
        }),
      ]);
    const { scope } = scopeWith(update);

    await holdCatalogueWriter(scope, 'run_1', async () => 1);
    await expect(
      holdCatalogueWriter(scope, 'run_1', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const [deploy, exception] = runs();
    expect(deploy).toMatchObject({
      outcome: 'failed',
      reason: 'deploy',
      cause: 'HTTP 500',
    });
    expect(exception).toMatchObject({ outcome: 'failed', reason: 'exception' });
    expect(exception.cause).toHaveLength(500);
    expect(exception.duration_ms).toBeGreaterThan(0);
  });

  it('logs nothing for a run another writer already closed, or one it could not record', async () => {
    const closed = scopeWith(jest.fn().mockResolvedValue([]));
    const unrecorded = scopeWith(jest.fn().mockRejectedValue(new Error('db')));

    await holdCatalogueWriter(closed.scope, 'run_1', async () => 1);
    await holdCatalogueWriter(unrecorded.scope, 'run_1', async () => 1);

    expect(runs()).toEqual([]);
    expect(unrecorded.logger.error).toHaveBeenCalledWith(
      'Catalogue run run_1 was not recorded: db',
    );
  });
});
