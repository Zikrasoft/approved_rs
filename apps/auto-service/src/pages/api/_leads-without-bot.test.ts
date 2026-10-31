import { afterAll, describe, expect, it, vi } from 'vitest';
import { LEADS_PATH } from '@podbor/lead-crm';
import type { MemoryStorage } from '@podbor/lead-crm/testing';

const token = vi.hoisted(() => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  return token;
});

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = (path: string) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

const pending = vi.hoisted(() => [] as Promise<unknown>[]);

vi.mock('@podbor/lead-crm/storage/local', () =>
  memory.module('localLeadStorage'),
);
vi.mock('@podbor/lead-crm/storage/vercel-blob', () =>
  memory.module('createVercelBlobStorage'),
);
vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));
vi.spyOn(console, 'error').mockImplementation(() => {});

import { POST as leads } from './leads';
import { POST as contactClick } from './contact-click';

const request = (body: URLSearchParams) =>
  new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { origin: 'http://localhost' },
    body,
  });

afterAll(() => {
  process.env.TELEGRAM_BOT_TOKEN = token;
});

describe('a Lead posted while the CRM bot is misconfigured', () => {
  it('is stored, and only its Telegram card is lost', async () => {
    const response = await leads({
      request: request(
        new URLSearchParams({ contact: '+381601234567', consent: '1' }),
      ),
      redirect: (path: string, status = 302) =>
        new Response(null, { status, headers: { location: path } }),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof leads>[0]);
    await contactClick({
      request: request(
        new URLSearchParams({
          channel: 'whatsapp',
          visitor_id: '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11',
        }),
      ),
    } as unknown as Parameters<typeof contactClick>[0]);
    await Promise.all(pending);

    expect(response.status).toBe(302);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({ contact: '+381601234567' }),
      expect.objectContaining({ contactChannel: 'whatsapp' }),
    ]);
  });
});
