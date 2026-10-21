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
    ['/services/brakes-suspension', '/sr/services/brakes-suspension'],
    ['/works/bmw-x3', '/sr/works/bmw-x3'],
    ['/parts/brakes', '/sr/parts/brakes'],
    ['/contact/', '/sr/contact/'],
    ['/thanks', '/sr/thanks/'],
    ['/privacy/', '/sr/privacy/'],
    ['/about', '/sr/about/'],
    ['/bmw', '/sr/bmw/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each(['/', '/sr/', '/en/parts/', '/llms.txt'])(
    'leaves %s alone',
    (path) => {
      expect(redirectFor(path)).toBeNull();
    },
  );
});
