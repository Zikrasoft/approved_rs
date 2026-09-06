import { isMap, type Document, type YAMLMap } from 'yaml';

// Every translate-*.ts script stores AI output under a `translations:` map
// alongside the ru source — this creates that map on first run (a file that
// predates the bot) and fails loudly if some other edit turned it into a
// non-map value.
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
