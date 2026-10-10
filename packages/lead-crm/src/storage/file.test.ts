import { chmod, mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileOrderMarkers, createFileStorage } from './file.ts';
import { StorageConflictError } from './types.ts';

describe('createFileStorage', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lead-crm-file-'));
  });

  afterEach(() => {
    dir = '';
  });

  const storage = (path = 'data/leads.json') =>
    createFileStorage({ path, dir });

  it('reads an empty snapshot when the file is not there yet', async () => {
    await expect(storage().read()).resolves.toEqual({
      raw: undefined,
      version: undefined,
    });
  });

  it('creates the directories on the way to the file', async () => {
    const store = storage('deep/nested/data/leads.json');
    await store.write([{ id: 'a' }], undefined);
    await expect(store.read()).resolves.toMatchObject({ raw: [{ id: 'a' }] });
  });

  it('reads back what it wrote, with a version', async () => {
    const store = storage();
    await store.write([{ id: 'a' }], undefined);
    const snapshot = await store.read();
    expect(snapshot.raw).toEqual([{ id: 'a' }]);
    expect(snapshot.version).toMatch(/^[0-9a-f]{40}$/);
  });

  it('moves the version when the contents change', async () => {
    const store = storage();
    await store.write([{ id: 'a' }], undefined);
    const first = await store.read();
    await store.write([{ id: 'b' }], first.version);
    const second = await store.read();
    expect(second.version).not.toBe(first.version);
  });

  it('refuses a write against a stale version', async () => {
    const store = storage();
    await store.write([{ id: 'a' }], undefined);
    const stale = await store.read();
    await store.write([{ id: 'b' }], stale.version);
    await expect(store.write([{ id: 'c' }], stale.version)).rejects.toThrow(
      StorageConflictError,
    );
    await expect(store.read()).resolves.toMatchObject({ raw: [{ id: 'b' }] });
  });

  it('creates only: a write without a version over an existing file is a conflict', async () => {
    const store = storage();
    await store.write([{ id: 'a' }], undefined);
    await expect(store.write([{ id: 'b' }], undefined)).rejects.toThrow(
      StorageConflictError,
    );
    await expect(store.read()).resolves.toMatchObject({ raw: [{ id: 'a' }] });
  });

  it('creates the file whole, in one step, and leaves no staging file behind', async () => {
    const store = storage();
    await Promise.allSettled([
      store.write([{ id: 'a' }], undefined),
      store.write([{ id: 'b' }], undefined),
    ]);
    const { raw } = await store.read();
    expect([[{ id: 'a' }], [{ id: 'b' }]]).toContainEqual(raw);
    expect(await readdir(join(dir, 'data'))).toEqual(['leads.json']);
  });

  it('lets any other create failure through', async () => {
    await mkdir(join(dir, 'data'), { recursive: true });
    await chmod(join(dir, 'data'), 0o500);
    await expect(storage().write([], undefined)).rejects.toThrow(/EACCES/);
  });

  it('rethrows a read failure that is not a missing file', async () => {
    await mkdir(join(dir, 'data', 'leads.json'), { recursive: true });
    await expect(storage().read()).rejects.toThrow(/EISDIR|EPERM|EACCES/);
  });

  it('rejects a file that is not JSON', async () => {
    await mkdir(join(dir, 'data'), { recursive: true });
    await writeFile(join(dir, 'data', 'leads.json'), 'not json');
    await expect(storage().read()).rejects.toThrow(SyntaxError);
  });

  it('says a file exists without reading it', async () => {
    await expect(storage().exists()).resolves.toBe(false);
    await mkdir(join(dir, 'data'), { recursive: true });
    await writeFile(join(dir, 'data', 'leads.json'), 'not json');
    await expect(storage().exists()).resolves.toBe(true);
  });
});

describe('createFileOrderMarkers', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'lead-crm-markers-'));
  });

  it('keeps one file per order and refuses to take a marker twice', async () => {
    const markers = createFileOrderMarkers({ dir });

    await expect(markers.has('order_01/../x')).resolves.toBe(false);

    await markers.add('order_01/../x');
    await expect(markers.has('order_01/../x')).resolves.toBe(true);

    await expect(markers.add('order_01/../x')).rejects.toThrow(/EEXIST/);
  });

  it('releases a marker so the order can be taken again', async () => {
    const markers = createFileOrderMarkers({ dir });

    await markers.add('order_02');
    await markers.release('order_02');

    await expect(markers.has('order_02')).resolves.toBe(false);
    await expect(markers.add('order_02')).resolves.toBeUndefined();
  });
});
