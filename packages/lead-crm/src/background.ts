const running = new Set<Promise<void>>();
let listening = false;

export async function backgroundIdle(): Promise<void> {
  while (running.size) await Promise.all(running);
}

const exitWhenSettled = () => {
  void backgroundIdle().then(() => process.exit(0));
};

export function inBackground(task: Promise<unknown>): void {
  if (!listening) {
    listening = true;
    process.once('SIGTERM', exitWhenSettled);
  }
  const settled: Promise<void> = task
    .then(
      () => undefined,
      (error: unknown) => console.error('[background] task failed', error),
    )
    .finally(() => running.delete(settled));
  running.add(settled);
}
