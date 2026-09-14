import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { SECTIONS } from '../../../scripts/translate-i18n';
import { WORK_DIRS } from '../../../scripts/translate-works';

const SIDECAR_KEYS = ['translations', 'translatedFrom'];

describe('i18n section registry', () => {
  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s points at a real YAML file',
    (path) => {
      expect(existsSync(path)).toBe(true);
    },
  );

  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s has no ru key the schema would silently drop',
    (path, section) => {
      const raw = parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
      const authored = Object.keys(raw).filter(
        (key) => !SIDECAR_KEYS.includes(key),
      );
      expect(authored.sort()).toEqual([...section.fields].sort());
    },
  );

  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s records the hash its translations were made from',
    (path) => {
      const raw = parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
      expect(typeof raw.translatedFrom).toBe('string');
    },
  );

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

  it('has no duplicate section paths', () => {
    const paths = SECTIONS.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('content directory registry', () => {
  it.each(WORK_DIRS)('%s exists', (dir) => {
    expect(existsSync(dir)).toBe(true);
  });
});
