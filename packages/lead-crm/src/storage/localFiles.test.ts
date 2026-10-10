import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localLeadStorage, localOrderMarkers } from './localFiles.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'lead-crm-local-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('localLeadStorage', () => {
  it('reads and writes the named file under the local data dir', async () => {
    const storage = localLeadStorage('data/leads.json', dir);
    const { version } = await storage.read();
    await storage.write([{ id: 1 }], version);
    expect(
      JSON.parse(await readFile(join(dir, 'data/leads.json'), 'utf8')),
    ).toEqual([{ id: 1 }]);
  });

  it('defaults to the local data dir without touching it until called', () => {
    expect(localLeadStorage('data/leads.json')).toHaveProperty('read');
  });
});

describe('localOrderMarkers', () => {
  it('keeps markers under the local data dir', async () => {
    const markers = localOrderMarkers(dir);
    await markers.add('order_1');
    expect(await markers.has('order_1')).toBe(true);
    expect(await localOrderMarkers(dir).has('order_1')).toBe(true);
  });

  it('defaults to the local data dir without touching it until called', () => {
    expect(localOrderMarkers()).toHaveProperty('has');
  });
});
