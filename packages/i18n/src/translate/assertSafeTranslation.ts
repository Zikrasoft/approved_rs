const HTML_TAG = /<[a-zA-Z/!]/;
const MIXED_SCRIPT_WORD =
  /\p{L}*(?:\p{Script=Latin}\p{Script=Cyrillic}|\p{Script=Cyrillic}\p{Script=Latin})\p{L}*/gu;
const TAG_NAME = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g;
const PLACEHOLDER = /\{[a-zA-Z][a-zA-Z0-9]*\}/g;

function tagNamesOf(text: string): Set<string> {
  return new Set(
    [...text.matchAll(TAG_NAME)].map((match) => match[1].toLowerCase()),
  );
}

function introducedTags(source: string, translated: string): string[] {
  const known = tagNamesOf(source);
  return [...tagNamesOf(translated)].filter((tag) => !known.has(tag));
}

export function assertSafeTranslation(
  source: unknown,
  translated: unknown,
  path: string,
): void {
  if (Array.isArray(source)) {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      throw new Error(
        `translated response for "${path}" has ${Array.isArray(translated) ? translated.length : 'no'} items, expected ${source.length}`,
      );
    }
    source.forEach((item, i) =>
      assertSafeTranslation(item, translated[i], `${path}[${i}]`),
    );
    return;
  }
  if (typeof source === 'string') {
    if (typeof translated !== 'string') {
      throw new Error(
        `translated response for "${path}" is missing (expected a string)`,
      );
    }
    if (source.trim() !== '' && translated.trim() === '') {
      throw new Error(`translated response for "${path}" came back blank`);
    }
    if (HTML_TAG.test(translated) && !HTML_TAG.test(source)) {
      throw new Error(
        `translated response for "${path}" contains raw HTML-looking content the source didn't have: ${translated}`,
      );
    }
    const dropped = [...new Set(source.match(PLACEHOLDER) ?? [])].filter(
      (token) => !translated.includes(token),
    );
    if (dropped.length > 0) {
      throw new Error(
        `translated response for "${path}" dropped placeholder tokens (${dropped.join(' ')}): ${translated}`,
      );
    }
    const mixedInSource = new Set(source.match(MIXED_SCRIPT_WORD) ?? []);
    const newlyMixed = (translated.match(MIXED_SCRIPT_WORD) ?? []).find(
      (word) => !mixedInSource.has(word),
    );
    if (newlyMixed !== undefined) {
      throw new Error(
        `translated response for "${path}" mixes Latin and Cyrillic inside one word ("${newlyMixed}"): ${translated}`,
      );
    }
    const introduced = introducedTags(source, translated);
    if (introduced.length > 0) {
      throw new Error(
        `translated response for "${path}" introduces HTML tags the source didn't have (${introduced.map((tag) => `<${tag}>`).join(' ')}): ${translated}`,
      );
    }
    return;
  }
  if (source === null || typeof source !== 'object') {
    if (translated !== source) {
      throw new Error(
        `translated response for "${path}" changed a non-text value: ${String(source)} -> ${String(translated)}`,
      );
    }
    return;
  }
  for (const key of Object.keys(source as Record<string, unknown>)) {
    assertSafeTranslation(
      (source as Record<string, unknown>)[key],
      (translated as Record<string, unknown> | undefined)?.[key],
      path ? `${path}.${key}` : key,
    );
  }
}
