import { describe, it, expect } from 'vitest';
import { parseDocument } from 'yaml';
import { getOrCreateTranslationsMap } from './getOrCreateTranslationsMap';

describe('getOrCreateTranslationsMap', () => {
  it('returns the existing translations map untouched', () => {
    const doc = parseDocument('translations:\n  en:\n    title: Hi\n');
    const map = getOrCreateTranslationsMap(doc, 'f.yaml');
    expect(map.get('en')).toBeTruthy();
  });

  it('creates an empty translations map when none exists', () => {
    const doc = parseDocument('title: Заголовок\n');
    const map = getOrCreateTranslationsMap(doc, 'f.yaml');
    expect(map.items).toEqual([]);
    expect(doc.get('translations', true)).toBe(map);
  });

  it('throws when translations exists but is not a map', () => {
    const doc = parseDocument('translations: nope\n');
    expect(() => getOrCreateTranslationsMap(doc, 'f.yaml')).toThrow(
      /f\.yaml.*not a map/,
    );
  });
});
