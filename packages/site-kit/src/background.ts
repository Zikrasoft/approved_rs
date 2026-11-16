const running = new Set<Promise<void>>();
let listening = false;

const drainThenTerminate = async () => {
  while (running.size) await Promise.all(running);
  if (process.listenerCount('SIGTERM') === 0)
    process.kill(process.pid, 'SIGTERM');
};

export function inBackground(task: Promise<unknown>): void {
  if (!listening) {
    listening = true;
    process.once('SIGTERM', () => void drainThenTerminate());
  }
  const settled: Promise<void> = task
    .then(
      () => undefined,
      (error: unknown) => console.error('[background] task failed', error),
    )
    .finally(() => running.delete(settled));
  running.add(settled);
}
