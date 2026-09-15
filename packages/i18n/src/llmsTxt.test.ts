import { describe, it, expect } from 'vitest';
import {
  LLMS_HEADINGS,
  llmsLanguageLinks,
  llmsLink,
  renderLlmsTxt,
} from './llmsTxt.ts';

describe('llmsLink', () => {
  it('writes a markdown bullet link', () => {
    expect(llmsLink('Contacts', 'https://x.rs/sr/contact/')).toBe(
      '- [Contacts](https://x.rs/sr/contact/)',
    );
  });

  it('escapes brackets in a label so an admin-typed title cannot break the link', () => {
    expect(llmsLink('BMW 3 [G20]', 'https://x.rs/works/bmw-3/')).toBe(
      '- [BMW 3 \\[G20\\]](https://x.rs/works/bmw-3/)',
    );
  });

  it('appends a note after an em dash when one is given', () => {
    expect(llmsLink('Cases', 'https://x.rs/cases/', '12 of them')).toBe(
      '- [Cases](https://x.rs/cases/) — 12 of them',
    );
  });
});

describe('llmsLanguageLinks', () => {
  it('points at every locale except the one being rendered', () => {
    expect(llmsLanguageLinks('https://x.rs', ['ru', 'sr', 'en'], 'sr')).toEqual(
      ['- https://x.rs/ru/llms.txt', '- https://x.rs/en/llms.txt'],
    );
  });

  it('is empty for a single-locale site', () => {
    expect(llmsLanguageLinks('https://x.rs', ['ru'], 'ru')).toEqual([]);
  });
});

describe('renderLlmsTxt', () => {
  it('separates sections with a blank line and ends with a newline', () => {
    expect(
      renderLlmsTxt('Details', 'Studio in Belgrade', [
        { heading: 'Services', items: ['- a', '- b'] },
        { heading: 'Other', items: ['- c'] },
      ]),
    ).toBe(
      [
        '# Details',
        '',
        '> Studio in Belgrade',
        '',
        '## Services',
        '',
        '- a',
        '- b',
        '',
        '## Other',
        '',
        '- c',
      ].join('\n') + '\n',
    );
  });

  it('drops a section with no items instead of leaving a dangling heading', () => {
    expect(
      renderLlmsTxt('Details', 'Studio', [
        { heading: 'Services', items: ['- a'] },
        { heading: 'Other Languages', items: [] },
      ]),
    ).toBe('# Details\n\n> Studio\n\n## Services\n\n- a\n');
  });

  it('renders a document with no sections at all', () => {
    expect(renderLlmsTxt('Details', 'Studio', [])).toBe(
      '# Details\n\n> Studio\n',
    );
  });
});

describe('LLMS_HEADINGS', () => {
  it.each(['keyFacts', 'other', 'languages'] as const)(
    'translates %s rather than repeating one language across locales',
    (field) => {
      const values = Object.values(LLMS_HEADINGS).map((h) => h[field]);
      expect(new Set(values).size).toBe(values.length);
    },
  );
});
