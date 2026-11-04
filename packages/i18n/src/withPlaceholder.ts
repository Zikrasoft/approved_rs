export const PLACEHOLDER = /\{[a-zA-Z][a-zA-Z0-9]*\}/g;

export function withPlaceholder(
  text: string,
  key: string,
  value: string,
): string {
  return text.replaceAll(`{${key}}`, value);
}

const placeholdersIn = (text: string): Set<string> =>
  new Set(text.match(PLACEHOLDER) ?? []);

export function placeholderDiff(
  source: string,
  translated: string,
): { dropped: string[]; invented: string[] } {
  const from = placeholdersIn(source);
  const to = placeholdersIn(translated);
  return {
    dropped: [...from].filter((token) => !to.has(token)),
    invented: [...to].filter((token) => !from.has(token)),
  };
}
