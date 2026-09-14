import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { SECTIONS } from './translate-i18n';
import { CASE_DIRS } from './translate-cases';

describe('i18n section registry', () => {
  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s points at a real YAML file',
    (path) => {
      expect(existsSync(path)).toBe(true);
    },
  );

  it.each(SECTIONS.map((s) => [s.path, s] as const))(
    '%s lists every translatable key its schema declares',
    (_path, section) => {
      expect([...section.fields].sort()).toEqual(
        [...section.schema.keyof().options].sort(),
      );
    },
  );

  it('has no duplicate section paths', () => {
    const paths = SECTIONS.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('case directory registry', () => {
  it.each(CASE_DIRS)('%s exists', (dir) => {
    expect(existsSync(dir)).toBe(true);
  });
});
