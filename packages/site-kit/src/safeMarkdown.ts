import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
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
