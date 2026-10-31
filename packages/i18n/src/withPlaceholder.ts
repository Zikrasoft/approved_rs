export const PLACEHOLDER = /\{[a-zA-Z][a-zA-Z0-9]*\}/g;

export function withPlaceholder(
  text: string,
  key: string,
  value: string,
): string {
  return text.replaceAll(`{${key}}`, value);
}
