import { GOALS, reachGoal } from './goals.ts';

export const DEPTH_DOOR_ATTRIBUTE = 'data-depth-door';
export const DEPTH_SLUG_ATTRIBUTE = 'data-depth-slug';
const BROWSING_DEPTH_STORAGE_KEY = 'case_browsing';

const VISIT_GAP_MS = 30 * 60 * 1000;
const DOOR_REVEAL_DEPTH = 2;

interface Visit {
  slugs: string[];
  at: number;
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
  const at: unknown = Reflect.get(value, 'at');
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  const slugs: unknown = Reflect.get(value, 'slugs');
  if (!Array.isArray(slugs)) return null;
  if (!slugs.every((slug): slug is string => typeof slug === 'string'))
    return null;
  return { slugs, at };
}

function recordView(slug: string, at: number): number {
  const previous = parseVisit(localStorage.getItem(BROWSING_DEPTH_STORAGE_KEY));
  const ongoing = previous && at - previous.at <= VISIT_GAP_MS;
  const slugs = new Set(ongoing ? previous.slugs : []).add(slug);
  const visit: Visit = { slugs: [...slugs], at };
  localStorage.setItem(BROWSING_DEPTH_STORAGE_KEY, JSON.stringify(visit));
  return slugs.size;
}

function depthAfterView(slug: string): number {
  try {
    return recordView(slug, Date.now());
  } catch {
    return 1;
  }
}

let armed = false;

export function defineBrowsingDepth(): void {
  if (armed) return;
  const slug = document
    .querySelector(`[${DEPTH_SLUG_ATTRIBUTE}]`)
    ?.getAttribute(DEPTH_SLUG_ATTRIBUTE);
  if (!slug) return;
  armed = true;

  const depth = depthAfterView(slug);
  reachGoal(GOALS.caseView, { depth });
  if (depth < DOOR_REVEAL_DEPTH) return;
  for (const door of document.querySelectorAll<HTMLElement>(
    `[${DEPTH_DOOR_ATTRIBUTE}]`,
  ))
    door.dataset.revealed = 'true';
}
