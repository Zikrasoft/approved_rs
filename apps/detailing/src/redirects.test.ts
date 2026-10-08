import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRedirectMatcher } from '@podbor/site-kit/redirects';
import { REDIRECTS } from './redirects';

const redirectFor = createRedirectMatcher(REDIRECTS);

describe('REDIRECTS', () => {
  it.each([
    ['/services', '/sr/services/'],
    ['/services/ceramic-coating', '/sr/services/ceramic-coating'],
    ['/works/bmw-x5', '/sr/works/bmw-x5'],
    ['/contact', '/sr/contact/'],
    ['/contact/', '/sr/contact/'],
    ['/thanks/', '/sr/thanks/'],
    ['/privacy', '/sr/privacy/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each(['/', '/sr/', '/en/services/', '/llms.txt', '/robots.txt'])(
    'leaves %s alone',
    (path) => {
      expect(redirectFor(path)).toBeNull();
    },
  );

  it('is what vercel.json carries', () => {
    const vercel = JSON.parse(
      readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
    );
    expect(vercel.redirects).toEqual(REDIRECTS);
  });
});
