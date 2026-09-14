import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { SECTIONS } from '../../../scripts/translate-i18n';

describe('i18n section registry', () => {
  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s has no translated key the ru source dropped',
    (path, section) => {
      const raw = parse(readFileSync(path, 'utf-8')) as {
        translations?: Record<string, unknown>;
      };
      // A key deleted from the ru source but left behind in a translation
      // block fails the strict schema, and loadSection then serves ru for that
      // whole section, in that locale, on every page. Unlike a *missing* key,
      // which CI fills in on the next push, an orphan never heals itself.
      for (const [locale, block] of Object.entries(raw.translations ?? {})) {
        const parsed = section.schema.safeParse(block);
        const orphans = parsed.success
          ? []
          : parsed.error.issues.flatMap((issue) =>
              issue.code === 'unrecognized_keys'
                ? issue.keys.map((key) => [...issue.path, key].join('.'))
                : [],
            );
        expect(orphans, `${path} ${locale}`).toEqual([]);
      }
    },
  );
});
