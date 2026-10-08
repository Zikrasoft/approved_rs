import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { ZodObject } from 'zod';

interface RegistryEntry {
  path: string;
  schema: ZodObject;
  fields?: readonly string[];
}

const SIDECAR_KEYS = ['translations', 'translatedFrom'];

export function orphanKeys(schema: ZodObject, block: unknown): string[] {
  const parsed = schema.safeParse(block);
  if (parsed.success) return [];
  return parsed.error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => [...issue.path, key].join('.'))
      : [],
  );
}

const readYaml = (path: string) =>
  parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;

const schemaKeys = (schema: ZodObject) =>
  [...(schema.keyof().options as readonly string[])].sort();

export function describeSectionRegistry(
  sections: readonly RegistryEntry[],
): void {
  const rows = sections.map((section) => [section.path, section] as const);

  describe('i18n section registry', () => {
    it.each(rows)('%s points at a real YAML file', (path) => {
      expect(existsSync(path)).toBe(true);
    });

    it.each(rows)(
      '%s lists every translatable key its schema declares',
      (_path, section) => {
        const fields = section.fields ?? schemaKeys(section.schema);
        expect([...fields].sort()).toEqual(schemaKeys(section.schema));
      },
    );

    it.each(rows)(
      '%s has no ru key the schema would silently drop',
      (path, section) => {
        const authored = Object.keys(readYaml(path)).filter(
          (key) => !SIDECAR_KEYS.includes(key),
        );
        expect(authored.sort()).toEqual(schemaKeys(section.schema));
      },
    );

    it.each(rows)(
      '%s records the hash its translations were made from',
      (path) => {
        expect(typeof readYaml(path).translatedFrom).toBe('string');
      },
    );

    it.each(rows)(
      '%s has no translated key the ru source dropped',
      (path, section) => {
        const translations = (readYaml(path).translations ?? {}) as Record<
          string,
          unknown
        >;
        for (const [locale, block] of Object.entries(translations)) {
          expect(
            orphanKeys(section.schema, block),
            `${path} ${locale}`,
          ).toEqual([]);
        }
      },
    );

    it('has no duplicate section paths', () => {
      const paths = sections.map((section) => section.path);
      expect(new Set(paths).size).toBe(paths.length);
    });
  });
}
