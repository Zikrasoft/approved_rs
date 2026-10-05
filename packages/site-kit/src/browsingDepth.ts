import { GOALS, reachGoal } from './goals.ts';

export const DEPTH_DOOR_ATTRIBUTE = 'data-depth-door';
const BROWSING_DEPTH_STORAGE_KEY = 'case_browsing';

const VISIT_GAP_MS = 30 * 60 * 1000;

interface Visit {
  slugs: string[];
  at: number;
}

export interface BrowsingDepthOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  now?: () => number;
  signal?: AbortSignal;
}

function parseVisit(raw: string | null): Visit | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { slugs, at } = value as Partial<Visit>;
  if (!Number.isFinite(at)) return null;
  if (!Array.isArray(slugs)) return null;
  if (!slugs.every((slug) => typeof slug === 'string')) return null;
  return { slugs, at: at as number };
}

function recordView(
  slug: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  at: number,
): number {
  const previous = parseVisit(storage.getItem(BROWSING_DEPTH_STORAGE_KEY));
  const ongoing = previous && at - previous.at <= VISIT_GAP_MS;
  const slugs = new Set(ongoing ? previous.slugs : []).add(slug);
  const visit: Visit = { slugs: [...slugs], at };
  storage.setItem(BROWSING_DEPTH_STORAGE_KEY, JSON.stringify(visit));
  return slugs.size;
}

function depthAfterView(
  slug: string,
  storage: BrowsingDepthOptions['storage'],
  now: () => number,
): number {
  try {
    return recordView(slug, storage ?? localStorage, now());
  } catch {
    return 1;
  }
}

let armed = false;

export function defineBrowsingDepth(
  slug: string,
  {
    storage,
    now = Date.now,
    signal = new AbortController().signal,
  }: BrowsingDepthOptions = {},
): void {
  if (armed) return;
  armed = true;
  signal.addEventListener('abort', () => {
    armed = false;
  });

  const depth = depthAfterView(slug, storage, now);
  reachGoal(GOALS.caseView, { depth });
  if (depth < 2) return;
  for (const door of document.querySelectorAll<HTMLElement>(
    `[${DEPTH_DOOR_ATTRIBUTE}]`,
  ))
    door.dataset.revealed = 'true';
}
