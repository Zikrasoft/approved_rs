import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  unprefixedSectionRedirects,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from './i18n/config';
import { PathBuilder } from './utils/paths';

const redirectFor = createRedirectMatcher(
  unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE),
);

describe('redirects', () => {
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
});
