import {
  clearCatalogueMemo,
  forgetCatalogueMemo,
  markCatalogueMemoStale,
  memoized,
} from '../catalogue-memo';
import { loggedEvents } from '../../../integration-tests/loggedEvents';

const counter = () => {
  let calls = 0;
  return jest.fn(async () => ++calls);
};

const TTL_MS = 10 * 60_000;

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('memoized', () => {
  beforeEach(() => clearCatalogueMemo());
  afterEach(() => jest.useRealTimers());

  it('computes a value once and answers it again until cleared', async () => {
    const compute = counter();

    expect(await memoized('counts', compute)).toBe(1);
    expect(await memoized('counts', compute)).toBe(1);

    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('keeps one value per name', async () => {
    expect(await memoized('a', async () => 'a')).toBe('a');
    expect(await memoized('b', async () => 'b')).toBe('b');
  });

  it('shares one computation between concurrent callers', async () => {
    const compute = counter();

    const both = await Promise.all([
      memoized('counts', compute),
      memoized('counts', compute),
    ]);

    expect(both).toEqual([1, 1]);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('makes the old values unreachable once cleared', async () => {
    const compute = counter();
    await memoized('counts', compute);

    clearCatalogueMemo();

    expect(await memoized('counts', compute)).toBe(2);
    expect(await memoized('counts', compute)).toBe(2);
  });

  it('does not keep a value a clear raced with', async () => {
    let release = (_: number) => {};
    const late = memoized(
      'counts',
      () => new Promise<number>((resolve) => (release = resolve)),
    );

    clearCatalogueMemo();
    release(1);

    expect(await late).toBe(1);
    expect(await memoized('counts', async () => 2)).toBe(2);
  });

  it('forgets a failed computation so the next call retries', async () => {
    await expect(
      memoized('counts', async () => {
        throw new Error('database gone');
      }),
    ).rejects.toThrow('database gone');

    expect(await memoized('counts', async () => 3)).toBe(3);
  });

  it('keeps a newer value when an older failure settles after a clear', async () => {
    let fail = (_: Error) => {};
    const doomed = memoized(
      'counts',
      () => new Promise<number>((_, reject) => (fail = reject)),
    );
    clearCatalogueMemo();
    const compute = counter();
    await memoized('counts', compute);

    fail(new Error('database gone'));
    await expect(doomed).rejects.toThrow('database gone');

    expect(await memoized('counts', compute)).toBe(1);
  });

  it('keeps a value before its time to live ends', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const compute = counter();
    await memoized('demand', compute, TTL_MS);

    jest.setSystemTime(new Date(Date.now() + TTL_MS - 1));
    expect(await memoized('demand', compute, TTL_MS)).toBe(1);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('serves the old value of an expired entry and refreshes it once in the background', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const compute = counter();
    await memoized('demand', compute, TTL_MS);
    jest.setSystemTime(new Date(Date.now() + TTL_MS));

    const reads = [
      memoized('demand', compute, TTL_MS),
      memoized('demand', compute, TTL_MS),
    ];
    expect(await Promise.all(reads)).toEqual([1, 1]);
    expect(compute).toHaveBeenCalledTimes(2);

    await flush();
    expect(await memoized('demand', compute, TTL_MS)).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps the old value when the background refresh fails, logs it once and waits 30 s before trying again', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await memoized('demand', async () => 'old', TTL_MS);
    jest.setSystemTime(new Date(Date.now() + TTL_MS));

    const failing = jest.fn(async () => {
      throw new Error('down');
    });
    expect(await memoized('demand', failing, TTL_MS)).toBe('old');
    await flush();
    expect(await memoized('demand', failing, TTL_MS)).toBe('old');
    await flush();
    const loggedAfterOne = loggedEvents('catalogue.warm');
    jest.setSystemTime(new Date(Date.now() + 29_999));
    expect(await memoized('demand', failing, TTL_MS)).toBe('old');
    expect(failing).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date(Date.now() + 1));
    expect(await memoized('demand', failing, TTL_MS)).toBe('old');
    await flush();
    log.mockRestore();

    expect(failing).toHaveBeenCalledTimes(2);
    expect(loggedAfterOne).toEqual([
      expect.objectContaining({
        event: 'catalogue.warm',
        outcome: 'failed',
        memo: 'demand',
        cause: expect.stringContaining('down'),
      }),
    ]);
  });

  it('serves the old value of a stale entry and swaps the fresh one in', async () => {
    const compute = counter();
    await memoized('counts', compute);
    markCatalogueMemoStale();

    expect(await memoized('counts', compute)).toBe(1);
    await flush();
    expect(await memoized('counts', compute)).toBe(2);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('marks only the named entries stale', async () => {
    const a = counter();
    const b = counter();
    await memoized('a', a);
    await memoized('b', b);
    markCatalogueMemoStale('a');

    await memoized('a', a);
    await memoized('b', b);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('forgets only the named entries', async () => {
    const a = counter();
    const b = counter();
    await memoized('a', a);
    await memoized('b', b);
    forgetCatalogueMemo('a');

    expect(await memoized('a', a)).toBe(2);
    expect(await memoized('b', b)).toBe(1);
  });

  it('keeps a value without a time to live until cleared', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T10:00:00Z') });
    const compute = counter();
    await memoized('counts', compute);

    jest.setSystemTime(new Date(Date.now() + 30 * TTL_MS));

    expect(await memoized('counts', compute)).toBe(1);
  });
});
