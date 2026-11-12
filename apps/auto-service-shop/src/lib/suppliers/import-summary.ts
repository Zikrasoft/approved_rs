import { nameKey } from '../../modules/_shared/keys';

const ARTICLE_SKIPS = [
  'brand',
  'unmapped',
  'excluded',
  'unreadable',
  'not_in_scope',
  'rejected',
] as const;

const ROW_SKIPS = ['currency', 'no_make'] as const;

export type SkipReason =
  (typeof ARTICLE_SKIPS)[number] | (typeof ROW_SKIPS)[number];

export type ImportOutcome = 'created' | 'updated' | 'unchanged';

type Problem = { number: string; reason: string };

export type ImportSummary = {
  supplier: string;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  skipped_by_reason: Record<SkipReason, number>;
  without_engine_code: number;
  unmapped_categories: { code: string; count: number }[];
  needs_category: string[];
  missing_fields: { number: string; category: string; fields: string[] }[];
  unanswered: Problem[];
  failed: Problem[];
};

export const importTally = (supplier: string) => {
  const summary: ImportSummary = {
    supplier,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    skipped_by_reason: Object.fromEntries(
      [...ARTICLE_SKIPS, ...ROW_SKIPS].map((reason) => [reason, 0]),
    ) as Record<SkipReason, number>,
    without_engine_code: 0,
    unmapped_categories: [],
    needs_category: [],
    missing_fields: [],
    unanswered: [],
    failed: [],
  };
  const unmapped = new Map<string, { code: string; count: number }>();
  const skip = (reason: SkipReason, count = 1) => {
    summary.skipped_by_reason[reason] += count;
    if ((ARTICLE_SKIPS as readonly string[]).includes(reason)) {
      summary.skipped += count;
    }
  };
  return {
    summary,
    skip,
    unmapped(code: string) {
      skip('unmapped');
      const key = nameKey(code);
      const tally = unmapped.get(key) ?? { code, count: 0 };
      tally.count += 1;
      unmapped.set(key, tally);
      summary.unmapped_categories = [...unmapped.values()]
        .map((entry) => ({ ...entry }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    },
    withoutEngineCode(count: number) {
      summary.without_engine_code += count;
    },
    imported(outcome: ImportOutcome) {
      summary[outcome] += 1;
    },
  };
};

export type ImportTally = ReturnType<typeof importTally>;
