import { parseDocument } from 'yaml';
import type { ZodObject } from 'zod';
import { hashSource, type SectionData } from './translate/hashSource.ts';

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
  return doc.get('translatedFrom') === hashSource(parsed.data);
}
