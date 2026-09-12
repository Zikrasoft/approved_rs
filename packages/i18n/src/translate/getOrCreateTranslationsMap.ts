import { isMap, type Document, type YAMLMap } from 'yaml';

export function getOrCreateTranslationsMap(
  doc: Document,
  path: string,
): YAMLMap {
  let node = doc.get('translations', true);
  if (node === undefined) {
    doc.set('translations', doc.createNode({}));
    node = doc.get('translations', true);
  }
  if (!isMap(node)) throw new Error(`${path}: "translations" is not a map`);
  return node;
}
