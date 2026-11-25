import {
  clearCatalogueMemo,
  DEMAND_TTL_MS,
  memoized,
  type PublishRuns,
} from '../catalogue-memo';

const runsOf = (ids: (string | undefined)[]) => {
  let current = ids;
  const listCatalogueRuns = jest.fn(async () =>
    current[0] === undefined ? [] : [{ id: current[0] }],
  );
  return {
    publish: { listCatalogueRuns } as unknown as PublishRuns,
    listCatalogueRuns,
    startRun: (id: string) => {
      current = [id];
    },
  };
};

const counter = () => {
  let calls = 0;
  return jest.fn(async () => ++calls);
};

describe('memoized', () => {
  beforeEach(() => clearCatalogueMemo());
  afterEach(() => jest.useRealTimers());

  it('computes a value once and answers it again under the same Publish run', async () => {
    const { publish, listCatalogueRuns } = runsOf(['run_1']);
    const compute = counter();

    expect(await memoized(publish, 'counts', compute)).toBe(1);
    expect(await memoized(publish, 'counts', compute)).toBe(1);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(listCatalogueRuns).toHaveBeenCalledWith(
      { kind: 'publish' },
      { select: ['id'], order: { created_at: 'DESC' }, take: 1 },
    );
  });

  it('keeps one value per name', async () => {
    const { publish } = runsOf(['run_1']);

    expect(await memoized(publish, 'a', async () => 'a')).toBe('a');
    expect(await memoized(publish, 'b', async () => 'b')).toBe('b');
  });

  it('shares one computation between concurrent callers', async () => {
    const { publish } = runsOf(['run_1']);
    const compute = counter();

    const both = await Promise.all([
      memoized(publish, 'counts', compute),
      memoized(publish, 'counts', compute),
    ]);

    expect(both).toEqual([1, 1]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('memoises while no Publish run exists yet', async () => {
    const { publish } = runsOf([undefined]);
    const compute = counter();

    await memoized(publish, 'counts', compute);

    expect(await memoized(publish, 'counts', compute)).toBe(1);
  });

  it('makes the old values unreachable once a new Publish run starts', async () => {
    const { publish, startRun } = runsOf(['run_1']);
    const compute = counter();
    await memoized(publish, 'counts', compute);

    startRun('run_2');

    expect(await memoized(publish, 'counts', compute)).toBe(2);
    expect(await memoized(publish, 'counts', compute)).toBe(2);
  });

  it('recomputes everything after a clear', async () => {
    const { publish } = runsOf(['run_1']);
    const compute = counter();
    await memoized(publish, 'counts', compute);

    clearCatalogueMemo();

    expect(await memoized(publish, 'counts', compute)).toBe(2);
  });

  it('does not keep a value a clear raced with', async () => {
    const { publish } = runsOf(['run_1']);
    let release = (_: number) => {};
    const late = memoized(
      publish,
      'counts',
      () => new Promise<number>((resolve) => (release = resolve)),
    );
    await new Promise((resolve) => setImmediate(resolve));

    clearCatalogueMemo();
    release(1);

    expect(await late).toBe(1);
    expect(await memoized(publish, 'counts', async () => 2)).toBe(2);
  });

  it('forgets a failed computation so the next call retries', async () => {
    const { publish } = runsOf(['run_1']);

    await expect(
      memoized(publish, 'counts', async () => {
        throw new Error('database gone');
      }),
    ).rejects.toThrow('database gone');

    expect(await memoized(publish, 'counts', async () => 3)).toBe(3);
  });

  it('expires a value with a time to live and keeps it before that', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const { publish } = runsOf(['run_1']);
    const compute = counter();
    await memoized(publish, 'demand', compute, DEMAND_TTL_MS);

    jest.setSystemTime(new Date(Date.now() + DEMAND_TTL_MS - 1));
    expect(await memoized(publish, 'demand', compute, DEMAND_TTL_MS)).toBe(1);

    jest.setSystemTime(new Date(Date.now() + 1));
    expect(await memoized(publish, 'demand', compute, DEMAND_TTL_MS)).toBe(2);
  });

  it('keeps a value without a time to live for the whole run', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const { publish } = runsOf(['run_1']);
    const compute = counter();
    await memoized(publish, 'counts', compute);

    jest.setSystemTime(new Date(Date.now() + 30 * DEMAND_TTL_MS));

    expect(await memoized(publish, 'counts', compute)).toBe(1);
  });
});
