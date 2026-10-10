import { afterAll, describe, expect, it, vi } from 'vitest';

const local = vi.hoisted(() => ({
  dir: `${process.env.TMPDIR?.replace(/\/$/, '') ?? '/tmp'}/carlab-markers-${process.pid}`,
}));
vi.mock('@podbor/lead-crm', async (importOriginal) => {
  const crm = await importOriginal<typeof import('@podbor/lead-crm')>();
  const fromLocalFiles: typeof crm.fromLocalFiles = async (open) =>
    open(await import('@podbor/lead-crm/storage/file'), local.dir);
  return { ...crm, fromLocalFiles };
});

const { orderMarkers } = await import('./orderMarkers');

describe('the order markers dev picks', () => {
  const orderId = 'order_01/../x';

  afterAll(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(local.dir, { recursive: true, force: true });
  });

  it('writes under the local data directory and refuses a second marker', async () => {
    expect(await orderMarkers.has(orderId)).toBe(false);

    await orderMarkers.add(orderId);
    expect(await orderMarkers.has(orderId)).toBe(true);

    const { readFile } = await import('node:fs/promises');
    const written = await readFile(
      `${local.dir}/shop-orders/order_01%2F..%2Fx.json`,
      'utf8',
    );
    expect(JSON.parse(written)).toMatchObject({ orderId });

    await expect(orderMarkers.add(orderId)).rejects.toThrow(/EEXIST/);

    await orderMarkers.release(orderId);
    expect(await orderMarkers.has(orderId)).toBe(false);
  });
});
