import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { SECTIONS } from '../../../scripts/translate-i18n';
import { WORK_DIRS } from '../../../scripts/translate-works';

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
});

describe('work directory registry', () => {
  it.each(WORK_DIRS)('%s exists', (dir) => {
    expect(existsSync(dir)).toBe(true);
  });
});
