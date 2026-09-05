// Schema validation alone only checks each leaf's type — an unbounded array
// (faq's question lists) can come back truncated and still pass, an
// optional field (home.yaml journey.note) can be dropped entirely and still
// pass, and a string leaf can come back containing raw HTML and still pass.
// All three matter here specifically because these files auto-commit
// straight to `main` with no PR review (unlike the hand-written TS/Keystatic
// form they replaced), and some of these strings render via `set:html`
// (JSON-LD schemas, case bodies) — so a truncated, silently-dropped, or
// HTML-carrying translation ships straight to production. Shared between
// translate-i18n.ts (nested YAML sections) and translate-cases.ts (flat
// {title, body}) — same trust boundary, same guard.
//
// Walks `source` (not `translated`) so a field the response is missing
// entirely still gets a path-qualified error instead of a silent skip.
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
    // Only flags HTML the translation introduced, not HTML already present
    // in the (trusted, admin-authored) source — several real case bodies
    // deliberately embed raw HTML (e.g. an `<ul class="icon-pin">` list)
    // that every existing translation already preserves.
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
