import { isMap, type YAMLMap } from 'yaml';
import type { TranslatableLocale } from '../../src/i18n/config.ts';

// A blank field is saved as '' rather than the key being omitted, so a
// leaf must be non-blank (not just present) to count as translated. A
// section field can be a plain string (leadForm, home, a case's title/body,
// ...) or a nested group/array (dictionary's "nav", faq's arrays of
// {q,a}) — recurse so a group only counts as translated once every string
// leaf inside it does.
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

// Shared by every translate-*.ts script — checks a locale's stored
// translation actually has content, not just a key present in the YAML.
export function hasRealTranslation(
  translationsNode: YAMLMap,
  locale: TranslatableLocale,
  fieldNames: readonly string[],
): boolean {
  const entry = translationsNode.get(locale, true);
  if (!isMap(entry)) return false;
  const plain = entry.toJSON() as Record<string, unknown>;
  // Every field must be translated, not just one — a locale isn't "real"
  // while any of its fields are still blank/missing.
  return fieldNames.every((field) => isFullyTranslated(plain[field]));
}
