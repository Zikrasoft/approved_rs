import { describe, it, expect } from 'vitest';
import { createUnlocalizedMatcher } from './unlocalizedPath.ts';

const isUnlocalized = createUnlocalizedMatcher({
  exact: ['/robots.txt', '/llms.txt', '/404', '/404/'],
  prefixes: ['/api/', '/keystatic', '/_image'],
});

describe('createUnlocalizedMatcher', () => {
  it.each(['/robots.txt', '/llms.txt', '/404', '/404/'])(
    'matches the exact path %s',
    (pathname) => {
      expect(isUnlocalized(pathname)).toBe(true);
    },
  );

  it.each([
    '/api/leads',
    '/keystatic',
    '/keystatic/collection/works',
    '/_image?href=x',
  ])('matches anything under the prefix %s', (pathname) => {
    expect(isUnlocalized(pathname)).toBe(true);
  });

  it.each(['/sitemap-index.xml', '/sitemap-0.xml', '/sitemap.xml'])(
    'matches the generated route %s',
    (pathname) => {
      expect(isUnlocalized(pathname)).toBe(true);
    },
  );

  it.each(['/', '/ru/', '/services/', '/sr/works/bmw-x5/', '/contact'])(
    'leaves %s to locale handling',
    (pathname) => {
      expect(isUnlocalized(pathname)).toBe(false);
    },
  );

  it('matches an exact path exactly, so a deeper path under it stays localized', () => {
    expect(isUnlocalized('/llms.txt/../admin')).toBe(false);
    expect(isUnlocalized('/robots.txt.bak')).toBe(false);
  });

  it('does not treat a page merely containing a prefix word as unlocalized', () => {
    expect(isUnlocalized('/ru/works/mapi/')).toBe(false);
  });

  it('does not match a sitemap-looking path outside the root', () => {
    expect(isUnlocalized('/ru/sitemap-0.xml')).toBe(false);
  });

  it('carries no defaults of its own — an empty config matches only sitemaps', () => {
    const none = createUnlocalizedMatcher({ exact: [], prefixes: [] });
    expect(none('/robots.txt')).toBe(false);
    expect(none('/sitemap-0.xml')).toBe(true);
  });
});
