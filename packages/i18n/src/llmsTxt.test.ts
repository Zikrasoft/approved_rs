import { describe, it, expect } from 'vitest';
import {
  llmsLanguageLinks,
  llmsLink,
  renderBrandLlmsTxt,
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

describe('renderBrandLlmsTxt', () => {
  const services = {
    heading: 'Services',
    index: { label: 'All services', href: 'https://x.rs/sr/services/' },
    entries: [
      { label: 'PPF', href: 'https://x.rs/sr/services/ppf/', note: 'Film' },
    ],
  };
  const works = {
    heading: 'Works',
    index: { label: 'All works', href: 'https://x.rs/sr/works/' },
    entries: [{ label: 'BMW X5', href: 'https://x.rs/sr/works/bmw-x5/' }],
  };
  const input = {
    site: { name: 'Details', url: 'https://x.rs', summary: 'Studio' },
    headings: { keyFacts: 'Facts', other: 'Other', languages: 'Languages' },
    facts: ['- 7 years'],
    lists: [services, works],
    other: [{ label: 'Home', href: 'https://x.rs/sr/' }],
    locales: ['ru', 'sr', 'en'],
    locale: 'sr',
  };

  it('puts the index link above the entries of each list', () => {
    expect(renderBrandLlmsTxt(input)).toBe(
      [
        '# Details',
        '',
        '> Studio',
        '',
        '## Facts',
        '',
        '- 7 years',
        '',
        '## Services',
        '',
        '- [All services](https://x.rs/sr/services/)',
        '- [PPF](https://x.rs/sr/services/ppf/) — Film',
        '',
        '## Works',
        '',
        '- [All works](https://x.rs/sr/works/)',
        '- [BMW X5](https://x.rs/sr/works/bmw-x5/)',
        '',
        '## Other',
        '',
        '- [Home](https://x.rs/sr/)',
        '',
        '## Languages',
        '',
        '- https://x.rs/ru/llms.txt',
        '- https://x.rs/en/llms.txt',
      ].join('\n') + '\n',
    );
  });

  it('keeps the lists in the order the site gave them', () => {
    const shop = {
      heading: 'Shop',
      index: { label: 'Parts', href: 'https://x.rs/sr/shop/' },
      entries: [],
    };
    const body = renderBrandLlmsTxt({
      ...input,
      lists: [services, shop, works],
    });
    expect(body.indexOf('## Shop')).toBeGreaterThan(
      body.indexOf('## Services'),
    );
    expect(body.indexOf('## Shop')).toBeLessThan(body.indexOf('## Works'));
  });

  it('omits a list the site does not have', () => {
    expect(renderBrandLlmsTxt(input)).not.toContain('## Shop');
  });

  it('keeps a list whose only link is the index', () => {
    const body = renderBrandLlmsTxt({
      ...input,
      lists: [{ ...works, entries: [] }],
    });
    expect(body).toContain('## Works\n\n- [All works](https://x.rs/sr/works/)');
  });
});
