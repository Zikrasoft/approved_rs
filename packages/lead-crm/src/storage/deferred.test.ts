import { describe, expect, it, vi } from 'vitest';
import type { OrderMarkers } from '../orderMarkers.ts';
import { deferOrderMarkers, deferStorage } from './deferred.ts';
import { createMemoryStorage } from './memory.testing.ts';

describe('deferStorage', () => {
  it('opens nothing until the first call, then reads and writes through the opened storage', async () => {
    const storage = createMemoryStorage();
    let open!: (value: typeof storage) => void;
    const deferred = deferStorage(new Promise((resolve) => (open = resolve)));

    const reading = deferred.read();
    open(storage);
    const { version } = await reading;
    await deferred.write([{ id: 'a' }], version);

    expect(storage.current()).toEqual([{ id: 'a' }]);
    expect((await deferred.read()).raw).toEqual([{ id: 'a' }]);
  });

  it('surfaces a storage that failed to open on every call', async () => {
    const deferred = deferStorage(Promise.reject(new Error('no disk')));

    await expect(deferred.read()).rejects.toThrow('no disk');
    await expect(deferred.write([], undefined)).rejects.toThrow('no disk');
  });
});

describe('deferOrderMarkers', () => {
  it('forwards every call to the opened markers', async () => {
    const markers: OrderMarkers = {
      has: vi.fn(async () => true),
      add: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
    };
    const deferred = deferOrderMarkers(Promise.resolve(markers));

    expect(await deferred.has('order_01')).toBe(true);
    await deferred.add('order_02');
    await deferred.release('order_03');

    expect(markers.has).toHaveBeenCalledWith('order_01');
    expect(markers.add).toHaveBeenCalledWith('order_02');
    expect(markers.release).toHaveBeenCalledWith('order_03');
  });
});
