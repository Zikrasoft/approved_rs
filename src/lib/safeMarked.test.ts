import { describe, it, expect } from 'vitest';
import { safeMarkdown, safeMarkdownInline } from './safeMarked';

describe('safeMarkdownInline', () => {
  it('renders a normal https link', () => {
    expect(safeMarkdownInline('[click me](https://example.com)')).toBe(
      '<a href="https://example.com">click me</a>',
    );
  });

  it('strips a javascript: link href, keeping the text', () => {
    expect(safeMarkdownInline('[click me](javascript:alert(1))')).toBe(
      '<a>click me</a>',
    );
  });

  it('strips a javascript: image src, keeping the alt text', () => {
    expect(safeMarkdownInline('![x](javascript:alert(1))')).toBe(
      '<img alt="x" />',
    );
  });

  it('still renders a normal image', () => {
    expect(safeMarkdownInline('![a car](https://example.com/x.png)')).toBe(
      '<img src="https://example.com/x.png" alt="a car" />',
    );
  });

  it('strips a protocol-relative link href (resolves to an external host, not same-site)', () => {
    expect(safeMarkdownInline('[click me](//evil.com/phish)')).toBe(
      '<a>click me</a>',
    );
  });

  it('still renders a same-site relative link', () => {
    expect(safeMarkdownInline('[home](/vehicle-sourcing)')).toBe(
      '<a href="/vehicle-sourcing">home</a>',
    );
  });

  it('still renders ordinary formatting untouched', () => {
    expect(safeMarkdownInline('**bold** text')).toBe(
      '<strong>bold</strong> text',
    );
  });

  it('strips a <script> tag and its content entirely', () => {
    expect(safeMarkdownInline('<script>alert(1)</script>hello')).toBe('hello');
  });
});

describe('safeMarkdown', () => {
  it("keeps a case body's hand-written icon list (class attribute preserved)", () => {
    expect(safeMarkdown('<ul class="icon-pin"><li>Белград</li></ul>')).toBe(
      '<ul class="icon-pin"><li>Белград</li></ul>',
    );
  });

  it('renders a paragraph of markdown as a block', () => {
    expect(safeMarkdown('**bold** text')).toBe(
      '<p><strong>bold</strong> text</p>\n',
    );
  });
});
