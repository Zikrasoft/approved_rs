import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('robots.txt', () => {
  const lines = readFileSync('public/robots.txt', 'utf8').split('\n');

  it.each(['facets', 'offset', 'range'])(
    'disallows faceted search through the %s parameter',
    (parameter) => {
      expect(lines).toContain(`Disallow: /*/parts/search?*${parameter}=`);
    },
  );
});
