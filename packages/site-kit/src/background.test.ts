import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => (await import('./background.ts')).inBackground;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

const tick = () => new Promise((done) => setTimeout(done, 0));

describe('inBackground', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    process.removeAllListeners('SIGTERM');
    vi.restoreAllMocks();
  });

  it('logs a failed task instead of leaving its rejection unhandled', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const inBackground = await load();
    const failure = new Error('telegram down');

    inBackground(Promise.reject(failure));
    await tick();

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[background] task failed', failure);
  });

  it('exits on SIGTERM only once the running tasks settle', async () => {
    const inBackground = await load();
    const task = deferred();
    inBackground(task.promise);
    inBackground(Promise.resolve());

    process.emit('SIGTERM');
    await tick();
    expect(process.exit).not.toHaveBeenCalled();

    task.resolve();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  });

  it('listens for SIGTERM once however many tasks run', async () => {
    const before = process.listenerCount('SIGTERM');
    const inBackground = await load();

    inBackground(Promise.resolve());
    inBackground(Promise.resolve());

    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
  });

  it('exits on SIGTERM at once when every task has finished', async () => {
    const inBackground = await load();
    inBackground(Promise.resolve());
    await tick();

    process.emit('SIGTERM');

    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  });
});
