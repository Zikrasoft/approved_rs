import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('robots.txt', () => {
  const lines = readFileSync('public/robots.txt', 'utf8').split('\n');
  const groupAfter = (header: string) => {
    const start = lines.indexOf(header);
    const end = lines.indexOf('', start);
    return lines.slice(start, end);
  };

  it.each(['facets', 'offset', 'range'])(
    'disallows faceted search through the %s parameter',
    (parameter) => {
      expect(lines).toContain(`Disallow: /*/parts/search?*${parameter}=`);
    },
  );

  it('slows the AI crawlers down and keeps the shared rules for them', () => {
    const shared = groupAfter('User-agent: *').slice(1);
    expect(groupAfter('User-agent: ClaudeBot')).toEqual([
      'User-agent: ClaudeBot',
      'User-agent: GPTBot',
      'User-agent: PerplexityBot',
      'Crawl-delay: 3',
      ...shared,
    ]);
  });
});
