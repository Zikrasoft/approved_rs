import type PublishModuleService from '../modules/publish/service';

export const DEMAND_TTL_MS = 10 * 60_000;

export type PublishRuns = Pick<PublishModuleService, 'listCatalogueRuns'>;

type Entry = { value: Promise<unknown>; expires: number };

let memo: { runId: string | null | undefined; entries: Map<string, Entry> } = {
  runId: undefined,
  entries: new Map(),
};

export function clearCatalogueMemo(): void {
  memo = { runId: undefined, entries: new Map() };
}

async function latestPublishRunId(publish: PublishRuns) {
  const [latest] = await publish.listCatalogueRuns(
    { kind: 'publish' },
    { select: ['id'], order: { created_at: 'DESC' }, take: 1 },
  );
  return latest?.id ?? null;
}

export async function memoized<T>(
  publish: PublishRuns,
  name: string,
  compute: () => Promise<T>,
  ttlMs = Infinity,
): Promise<T> {
  const runId = await latestPublishRunId(publish);
  if (memo.runId !== runId) memo = { runId, entries: new Map() };
  const { entries } = memo;
  const known = entries.get(name);
  if (known && known.expires > Date.now()) return known.value as Promise<T>;
  const value = compute();
  entries.set(name, { value, expires: Date.now() + ttlMs });
  value.catch(() => entries.delete(name));
  return value;
}
