// Shared by every src/i18n/content/*.ts reader that stores a template
// string with a literal {paramName} token (services.ts, meta.ts, pages.ts)
// instead of a function, so it round-trips through YAML/zod/the AI
// translator like any other string. `replaceAll`, not `replace` — a token
// can appear more than once in a translated sentence.
export function withPlaceholder(
  text: string,
  key: string,
  value: string,
): string {
  return text.replaceAll(`{${key}}`, value);
}
