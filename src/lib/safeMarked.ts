import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// marked's `sanitize` option was removed years ago — by default it renders
// any link/image href verbatim, including a `javascript:` URI, straight
// into `<a href>`/`<img src>`. Every call site here renders AI-translated
// or admin-written markdown via `set:html`, so `sanitizeHtml` is the actual
// XSS boundary, not `marked` alone. `class` is allowed on every tag because
// real case bodies embed hand-written lists like `<ul class="icon-pin">`
// for icon styling — dropping it would silently break existing content.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // sanitize-html's `allowedSchemes` doesn't reject `//host/path` on its
  // own — the browser resolves that against the current scheme, i.e. an
  // external link, not a same-site relative path.
  allowProtocolRelative: false,
};

export function safeMarkdown(markdown: string): string {
  return sanitizeHtml(
    marked.parse(markdown, { async: false }),
    SANITIZE_OPTIONS,
  );
}

export function safeMarkdownInline(markdown: string): string {
  return sanitizeHtml(
    marked.parseInline(markdown, { async: false }),
    SANITIZE_OPTIONS,
  );
}
