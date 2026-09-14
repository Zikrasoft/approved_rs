// JSON.stringify does not escape "<", and a JSON-LD block is written through a
// raw-HTML sink — a content string containing "</script>" would close the block
// and everything after it would be parsed as markup.
export function jsonLdText(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
