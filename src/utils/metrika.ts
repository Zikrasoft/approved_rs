import { YM_COUNTER_ID } from './constants';

// Single call site for Metrika goals — callers don't need the counter ID or
// the "ym not loaded yet" (pre cookie-consent) guard repeated at each site.
export function ymReachGoal(goal: string, params?: Record<string, unknown>) {
  const ym = window.ym;
  if (ym) {
    ym(YM_COUNTER_ID, 'reachGoal', goal, params);
  } else {
    console.debug('[ym] skipped goal (no consent yet):', goal, params);
  }
}
