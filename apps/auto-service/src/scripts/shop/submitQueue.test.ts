// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { submitQueue } from './submitQueue';

const button = () => {
  const node = document.createElement('button');
  node.textContent = 'Poruči';
  return node;
};

describe('submitQueue', () => {
  it('runs one operation at a time and the last queued one after it', async () => {
    const order: string[] = [];
    let release!: () => void;
    const submit = submitQueue(button(), vi.fn(), vi.fn());

    const first = submit(
      () =>
        new Promise<void>(
          (resolve) => (release = () => (order.push('first'), resolve())),
        ),
    );
    void submit(async () => void order.push('dropped'));
    void submit(async () => void order.push('last'));
    expect(submit.busy()).toBe(true);
    release();
    await first;

    expect(order).toEqual(['first', 'last']);
  });

  it('reports a failure, restores the label and re-enables nothing itself', async () => {
    const node = button();
    const onError = vi.fn();
    const onIdle = vi.fn();
    const submit = submitQueue(node, onError, onIdle);

    await submit(async () => {
      node.textContent = 'Šaljemo…';
      throw new Error('nope');
    });

    expect(onError).toHaveBeenLastCalledWith(expect.any(Error));
    expect(node.textContent).toBe('Poruči');
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('does nothing once stopped', async () => {
    const operation = vi.fn();
    const submit = submitQueue(button(), vi.fn(), vi.fn());
    submit.stop();

    await submit(operation);

    expect(operation).not.toHaveBeenCalled();
  });
});
