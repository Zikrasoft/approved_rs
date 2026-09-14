import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuarantine, QUARANTINE_PATH } from './quarantine.ts';
import { createMemoryStorage } from './storage/memory.testing.ts';

function build(send = vi.fn().mockResolvedValue(undefined)) {
  const storage = createMemoryStorage();
  const quarantine = createQuarantine({
    storage,
    brand: 'CarLab',
    getNotifier: () =>
      Promise.resolve({ notifier: { sendQuarantinedLeadsToAdmin: send } }),
  });
  return { storage, quarantine, send };
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

describe('createQuarantine', () => {
  it('starts the file and tells the admin how many and under which brand', async () => {
    const { storage, quarantine, send } = build();

    await quarantine([{ id: 1 }]);

    expect(storage.current()).toEqual([{ id: 1 }]);
    expect(send).toHaveBeenCalledWith(1, QUARANTINE_PATH, 'CarLab');
  });

  it('appends rather than replacing, and counts only what it added', async () => {
    const { storage, quarantine, send } = build();
    storage.seed([{ id: 1 }]);

    await quarantine([{ id: 2 }]);

    expect(storage.current()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(send).toHaveBeenCalledWith(1, QUARANTINE_PATH, 'CarLab');
  });

  it('copies a record once however often it is offered', async () => {
    const { storage, quarantine, send } = build();

    await quarantine([{ id: 1 }]);
    await quarantine([{ id: 1 }]);
    await quarantine([{ id: 1 }, { id: 2 }]);

    expect(storage.current()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(1, QUARANTINE_PATH, 'CarLab');
  });

  it('refuses to overwrite a quarantine file that is not a list', async () => {
    const { storage, quarantine } = build();
    storage.seed('not a list');

    await expect(quarantine([{ id: 2 }])).rejects.toThrow(
      /quarantine file is string, not an array/,
    );
    expect(storage.current()).toBe('not a list');
  });

  it('treats the copy as done even when the notice cannot be sent', async () => {
    const send = vi.fn().mockRejectedValue(new Error('telegram down'));
    const { storage, quarantine } = build(send);

    await expect(quarantine([{ id: 3 }])).resolves.toBeUndefined();
    expect(storage.current()).toEqual([{ id: 3 }]);
  });

  it('lets a write conflict surface so the caller can retry', async () => {
    const { storage, quarantine, send } = build();
    storage.failNextWrites(1);

    await expect(quarantine([{ id: 4 }])).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
