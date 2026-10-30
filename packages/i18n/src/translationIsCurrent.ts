import { parseDocument } from 'yaml';
import { z, type ZodObject } from 'zod';
import { hashSource, type SectionData } from './translate/hashSource.ts';

export function translationIsCurrent(
  fileText: string,
  schema: ZodObject,
): boolean {
  const doc = parseDocument(fileText);
  const plain = z.record(z.string(), z.unknown()).safeParse(doc.toJS());
  if (!plain.success) return false;
  const source: SectionData = {};
  for (const field of schema.keyof().options) {
    if (plain.data[field] !== undefined) source[field] = plain.data[field];
  }
  const parsed = schema.safeParse(source);
  if (!parsed.success) return false;
  return doc.get('translatedFrom') === hashSource(parsed.data);
}
