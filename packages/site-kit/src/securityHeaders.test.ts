import { describe, expect, it } from 'vitest';
import { ANALYTICS_ORIGINS } from './analyticsHosts.ts';
import { CONTENT_SECURITY_POLICY } from './securityHeaders.ts';

const sources = (directive: string) =>
  CONTENT_SECURITY_POLICY.split('; ')
    .find((entry) => entry.startsWith(`${directive} `))
    ?.split(' ')
    .slice(1) ?? [];

describe('the content security policy', () => {
  it.each(ANALYTICS_ORIGINS)(
    'lets the page load and talk to %s, which site-kit loads a tag from',
    (origin) => {
      expect(sources('script-src')).toContain(origin);
      expect(sources('connect-src')).toContain(origin);
    },
  );

  it('keeps plugins out and the base and form targets on the site', () => {
    expect(sources('object-src')).toEqual(["'none'"]);
    expect(sources('base-uri')).toEqual(["'self'"]);
    expect(sources('form-action')).toEqual(["'self'"]);
  });
});
