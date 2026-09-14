import { parseDocument } from 'yaml';
import type { ZodObject } from 'zod';
import { sha256Hex } from './translate/sha256Hex.ts';

type SectionData = Record<string, unknown>;

// True once CI has translated the ru copy that is in the file right now.
// Russian is edited by hand and the translate job runs on push, so between the
// two the other locales legitimately fall back to ru — a test that asserts
// "every locale differs from ru" has to stand down for exactly that window.
export function translationIsCurrent(
  fileText: string,
  schema: ZodObject,
): boolean {
  const doc = parseDocument(fileText);
  const plain = doc.toJS() as SectionData;
  const source: SectionData = {};
  for (const field of schema.keyof().options) {
    if (plain[field] !== undefined) source[field] = plain[field];
  }
  const parsed = schema.safeParse(source);
  if (!parsed.success) return false;
  return doc.get('translatedFrom') === sha256Hex(JSON.stringify(parsed.data));
}
