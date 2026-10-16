import { describe, expect, it, vi } from 'vitest';
import { checkHealth } from './health.ts';

function fakePool(result: { ok: boolean }) {
  return {
    query: vi.fn(async () => {
      if (!result.ok) throw new Error('connection refused');
      return { rows: [{ '?column?': 1 }] };
    }),
  };
}

function fakeFetch(ok: boolean) {
  return vi.fn(async () => {
    if (!ok) throw new Error('fetch failed');
    return new Response(null, { status: 200 });
  });
}

describe('checkHealth', () => {
  it('reports ok when both Postgres and Meilisearch answer', async () => {
    const result = await checkHealth({
      pool: fakePool({ ok: true }) as never,
      meiliUrl: 'http://meili.local',
      fetchImpl: fakeFetch(true),
    });

    expect(result).toEqual({ ok: true, postgres: true, meilisearch: true });
  });

  it('reports not ok when Postgres is down, leaving Meilisearch unaffected', async () => {
    const result = await checkHealth({
      pool: fakePool({ ok: false }) as never,
      meiliUrl: 'http://meili.local',
      fetchImpl: fakeFetch(true),
    });

    expect(result).toEqual({ ok: false, postgres: false, meilisearch: true });
  });

  it('reports not ok when Meilisearch is down, leaving Postgres unaffected', async () => {
    const result = await checkHealth({
      pool: fakePool({ ok: true }) as never,
      meiliUrl: 'http://meili.local',
      fetchImpl: fakeFetch(false),
    });

    expect(result).toEqual({ ok: false, postgres: true, meilisearch: false });
  });

  it('reports not ok when Meilisearch answers with a non-2xx status', async () => {
    const result = await checkHealth({
      pool: fakePool({ ok: true }) as never,
      meiliUrl: 'http://meili.local',
      fetchImpl: vi.fn(async () => new Response(null, { status: 503 })),
    });

    expect(result).toEqual({ ok: false, postgres: true, meilisearch: false });
  });
});
