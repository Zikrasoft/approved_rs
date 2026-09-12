import { describe, it, expect } from 'vitest';
import { safeMarkdown, safeMarkdownInline } from './safeMarkdown.ts';

describe('safeMarkdown', () => {
  it('renders a normal https link', () => {
    expect(safeMarkdown('[click me](https://example.com)')).toBe(
      '<p><a href="https://example.com">click me</a></p>\n',
    );
  });

  it('strips a javascript: link href, keeping the text', () => {
    expect(safeMarkdown('[click me](javascript:alert(1))')).toBe(
      '<p><a>click me</a></p>\n',
    );
  });

  it('strips a javascript: image src, keeping the alt text', () => {
    expect(safeMarkdown('![x](javascript:alert(1))')).toBe(
      '<p><img alt="x" /></p>\n',
    );
  });

  it('still renders a normal image', () => {
    expect(safeMarkdown('![a car](https://example.com/x.png)')).toBe(
      '<p><img src="https://example.com/x.png" alt="a car" /></p>\n',
    );
  });

  it('strips a protocol-relative href — it resolves to an external host, not same-site', () => {
    expect(safeMarkdown('[click me](//evil.com/phish)')).toBe(
      '<p><a>click me</a></p>\n',
    );
  });

  it('still renders a same-site relative link', () => {
    expect(safeMarkdown('[home](/usluge)')).toBe(
      '<p><a href="/usluge">home</a></p>\n',
    );
  });

  it('strips a script tag and its content entirely', () => {
    expect(safeMarkdown('<script>alert(1)</script>hello')).toBe('hello');
  });

  it('strips an inline event handler', () => {
    expect(safeMarkdown('<img src="https://x/y.png" onerror="alert(1)">')).toBe(
      '<img src="https://x/y.png" />',
    );
  });

  it('strips an iframe', () => {
    expect(safeMarkdown('<iframe src="https://evil.com"></iframe>')).toBe('');
  });

  it('keeps a hand-written icon list, class attribute included', () => {
    expect(safeMarkdown('<ul class="icon-pin"><li>Белград</li></ul>')).toBe(
      '<ul class="icon-pin"><li>Белград</li></ul>',
    );
  });

  it('renders ordinary formatting untouched', () => {
    expect(safeMarkdown('**bold** text')).toBe(
      '<p><strong>bold</strong> text</p>\n',
    );
  });

  it('keeps a mailto and a tel link', () => {
    expect(
      safeMarkdown('[mail](mailto:a@b.rs) [call](tel:+381600000000)'),
    ).toBe(
      '<p><a href="mailto:a@b.rs">mail</a> <a href="tel:+381600000000">call</a></p>\n',
    );
  });
});

describe('safeMarkdownInline', () => {
  it('renders without wrapping the result in a paragraph', () => {
    expect(safeMarkdownInline('**bold** text')).toBe(
      '<strong>bold</strong> text',
    );
  });

  it('applies the same sanitizer, so a javascript: href still goes', () => {
    expect(safeMarkdownInline('[click me](javascript:alert(1))')).toBe(
      '<a>click me</a>',
    );
  });

  it('applies the same protocol-relative guard', () => {
    expect(safeMarkdownInline('[click me](//evil.com/phish)')).toBe(
      '<a>click me</a>',
    );
  });
});
