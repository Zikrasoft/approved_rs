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
    vi.spyOn(process, 'kill').mockImplementation(() => true);
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

  it('re-raises SIGTERM only once the running tasks settle', async () => {
    const inBackground = await load();
    const task = deferred();
    inBackground(task.promise);
    inBackground(Promise.resolve());

    process.emit('SIGTERM');
    await tick();
    expect(process.kill).not.toHaveBeenCalled();

    task.resolve();
    await vi.waitFor(() =>
      expect(process.kill).toHaveBeenCalledWith(process.pid, 'SIGTERM'),
    );
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('also waits for a task that starts while it drains', async () => {
    const inBackground = await load();
    const first = deferred();
    const late = deferred();
    inBackground(first.promise);

    process.emit('SIGTERM');
    inBackground(late.promise);
    first.resolve();
    await tick();
    await tick();
    expect(process.kill).not.toHaveBeenCalled();

    late.resolve();
    await vi.waitFor(() => expect(process.kill).toHaveBeenCalledOnce());
  });

  it('leaves the shutdown to another SIGTERM listener when there is one', async () => {
    const other = vi.fn();
    const inBackground = await load();
    inBackground(Promise.resolve());
    process.on('SIGTERM', other);

    process.emit('SIGTERM');
    await tick();
    await tick();

    expect(other).toHaveBeenCalledOnce();
    expect(process.kill).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('listens for SIGTERM once however many tasks run', async () => {
    const before = process.listenerCount('SIGTERM');
    const inBackground = await load();

    inBackground(Promise.resolve());
    inBackground(Promise.resolve());

    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
  });

  it('re-raises SIGTERM at once when every task has finished', async () => {
    const inBackground = await load();
    inBackground(Promise.resolve());
    await tick();

    process.emit('SIGTERM');

    await vi.waitFor(() =>
      expect(process.kill).toHaveBeenCalledWith(process.pid, 'SIGTERM'),
    );
  });

  it('reports idle only once a task started by a running task settles too', async () => {
    const { inBackground, backgroundIdle } = await import('./background.ts');
    const second = deferred();
    let done = false;
    inBackground(
      Promise.resolve().then(() =>
        inBackground(second.promise.then(() => (done = true))),
      ),
    );

    const idle = backgroundIdle();
    await tick();
    second.resolve();
    await idle;

    expect(done).toBe(true);
  });
});
