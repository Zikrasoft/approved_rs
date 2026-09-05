import { describe, it, expect } from 'vitest';
import { parseDocument, isMap } from 'yaml';
import { hasRealTranslation } from './hasRealTranslation';

function translationsNode(yaml: string) {
  const doc = parseDocument(yaml);
  const node = doc.get('translations', true);
  if (!isMap(node)) throw new Error('fixture must have a translations map');
  return node;
}

describe('hasRealTranslation', () => {
  it('is true when every field is a non-blank string', () => {
    const node = translationsNode(
      'translations:\n  en:\n    greeting: Hello\n    farewell: Bye\n',
    );
    expect(hasRealTranslation(node, 'en', ['greeting', 'farewell'])).toBe(true);
  });

  it('is false when one field is a blank string', () => {
    const node = translationsNode(
      'translations:\n  en:\n    greeting: Hello\n    farewell: ""\n',
    );
    expect(hasRealTranslation(node, 'en', ['greeting', 'farewell'])).toBe(
      false,
    );
  });

  it('is false when one field is entirely missing', () => {
    const node = translationsNode(
      'translations:\n  en:\n    greeting: Hello\n',
    );
    expect(hasRealTranslation(node, 'en', ['greeting', 'farewell'])).toBe(
      false,
    );
  });

  it('is false for a locale absent entirely', () => {
    const node = translationsNode(
      'translations:\n  en:\n    greeting: Hello\n    farewell: Bye\n',
    );
    expect(hasRealTranslation(node, 'de', ['greeting', 'farewell'])).toBe(
      false,
    );
  });

  it('recurses into nested groups (dictionary-shaped fields) and requires every leaf non-blank', () => {
    const node = translationsNode(
      'translations:\n  en:\n    nav:\n      home: Home\n      cases: ""\n',
    );
    expect(hasRealTranslation(node, 'en', ['nav'])).toBe(false);
  });

  it('recurses into arrays of objects (FAQ-shaped fields) and requires every leaf non-blank', () => {
    const node = translationsNode(
      'translations:\n  en:\n    general:\n      - q: How much?\n        a: On request.\n',
    );
    expect(hasRealTranslation(node, 'en', ['general'])).toBe(true);

    const partial = translationsNode(
      'translations:\n  en:\n    general:\n      - q: How much?\n        a: ""\n',
    );
    expect(hasRealTranslation(partial, 'en', ['general'])).toBe(false);
  });

  it('is false for an empty array, not vacuously true', () => {
    const node = translationsNode('translations:\n  en:\n    general: []\n');
    expect(hasRealTranslation(node, 'en', ['general'])).toBe(false);
  });

  it('works for a flat case-shaped {title, body} entry', () => {
    const full = translationsNode(
      'translations:\n  en:\n    title: Some title\n    body: Some body\n',
    );
    expect(hasRealTranslation(full, 'en', ['title', 'body'])).toBe(true);

    const blankBody = translationsNode(
      'translations:\n  en:\n    title: Some title\n    body: ""\n',
    );
    expect(hasRealTranslation(blankBody, 'en', ['title', 'body'])).toBe(false);
  });
});
