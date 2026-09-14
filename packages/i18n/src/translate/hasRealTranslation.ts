import { isMap, type YAMLMap } from 'yaml';

function isFullyTranslated(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value))
    return value.length > 0 && value.every(isFullyTranslated);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(
      isFullyTranslated,
    );
  }
  return value !== undefined && value !== null;
}

export function hasRealTranslation(
  translationsNode: YAMLMap,
  locale: string,
  fieldNames: readonly string[],
): boolean {
  const entry = translationsNode.get(locale, true);
  if (!isMap(entry)) return false;
  const plain = entry.toJSON() as Record<string, unknown>;
  return fieldNames.every((field) => isFullyTranslated(plain[field]));
}
