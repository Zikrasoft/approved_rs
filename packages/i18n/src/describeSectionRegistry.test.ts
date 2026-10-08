import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { z } from 'zod';
import {
  describeSectionRegistry,
  orphanKeys,
} from './describeSectionRegistry.ts';

const schema = z
  .object({
    nav: z.object({ home: z.string() }).strict(),
    title: z.string(),
  })
  .strict();

const dir = mkdtempSync(join(tmpdir(), 'registry-'));

function fixture(name: string, data: Record<string, unknown>): string {
  const path = join(dir, name);
  writeFileSync(path, stringify(data));
  return path;
}

const RU = { nav: { home: 'Главная' }, title: 'Заголовок' };

describeSectionRegistry([
  {
    path: fixture('listed.yaml', {
      ...RU,
      translations: {
        en: { nav: { home: 'Home' }, title: 'Title' },
        sr: { nav: { home: 'Početna' } },
      },
      translatedFrom: 'abc',
    }),
    schema,
    fields: ['title', 'nav'],
  },
  {
    path: fixture('bare.yaml', { ...RU, translatedFrom: 'abc' }),
    schema,
  },
]);

describe('orphanKeys', () => {
  it('finds nothing in a block the schema accepts', () => {
    expect(orphanKeys(schema, { nav: { home: 'Home' }, title: 'T' })).toEqual(
      [],
    );
  });

  it('ignores a key a translation has yet to receive', () => {
    expect(orphanKeys(schema, { nav: { home: 'Home' } })).toEqual([]);
  });

  it('names a key the ru source no longer has, with its path', () => {
    expect(
      orphanKeys(schema, {
        nav: { home: 'Home', cases: 'Cases' },
        title: 'T',
        old: 'x',
      }),
    ).toEqual(['nav.cases', 'old']);
  });
});
