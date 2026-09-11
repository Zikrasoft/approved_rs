export function withPlaceholder(
  text: string,
  key: string,
  value: string,
): string {
  return text.replaceAll(`{${key}}`, value);
}
