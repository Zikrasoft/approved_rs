import { describe, expect, it } from 'vitest';
import { ANALYTICS_ORIGINS } from './analyticsHosts.ts';
import {
  CONTENT_SECURITY_POLICY,
  caddySecurityHeaders,
} from './securityHeaders.ts';

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

  it('lets GA4 send hits to the bare analytics.google.com, which no wildcard covers', () => {
    expect(sources('connect-src')).toContain('https://analytics.google.com');
  });

  it('sends violations to the site report route', () => {
    expect(sources('report-uri')).toEqual(['/api/csp-report']);
  });

  it('keeps plugins out and the base and form targets on the site', () => {
    expect(sources('object-src')).toEqual(["'none'"]);
    expect(sources('base-uri')).toEqual(["'self'"]);
    expect(sources('form-action')).toEqual(["'self'"]);
  });
});

describe('caddySecurityHeaders', () => {
  it('sets every security header on every response and hides the server', () => {
    expect(caddySecurityHeaders()).toBe(
      [
        'header {',
        '\tdefer',
        '\tContent-Security-Policy "frame-ancestors \'self\'"',
        `\tContent-Security-Policy-Report-Only ${JSON.stringify(CONTENT_SECURITY_POLICY)}`,
        '\tX-Content-Type-Options "nosniff"',
        '\tReferrer-Policy "strict-origin-when-cross-origin"',
        '\tPermissions-Policy "camera=(), microphone=(), geolocation=()"',
        '\tStrict-Transport-Security "max-age=63072000; includeSubDomains"',
        '\t-Server',
        '}',
        '',
      ].join('\n'),
    );
  });
});
