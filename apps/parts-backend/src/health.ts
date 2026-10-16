import type { Pool } from 'pg';

export type HealthResult = {
  ok: boolean;
  postgres: boolean;
  meilisearch: boolean;
};

export async function checkHealth({
  pool,
  meiliUrl,
  fetchImpl = fetch,
}: {
  pool: Pool;
  meiliUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<HealthResult> {
  const [postgres, meilisearch] = await Promise.all([
    pool
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false),
    fetchImpl(`${meiliUrl}/health`)
      .then((response) => response.ok)
      .catch(() => false),
  ]);

  return { ok: postgres && meilisearch, postgres, meilisearch };
}
