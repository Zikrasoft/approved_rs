const HTML_TAG = /<[a-zA-Z/!]/;

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
    if (HTML_TAG.test(translated) && !HTML_TAG.test(source)) {
      throw new Error(
        `translated response for "${path}" contains raw HTML-looking content the source didn't have: ${translated}`,
      );
    }
    return;
  }
  if (source !== null && typeof source === 'object') {
    for (const key of Object.keys(source as Record<string, unknown>)) {
      assertSafeTranslation(
        (source as Record<string, unknown>)[key],
        (translated as Record<string, unknown> | undefined)?.[key],
        path ? `${path}.${key}` : key,
      );
    }
  }
}
