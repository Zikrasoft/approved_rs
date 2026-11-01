import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CSP_REPORT_MAX_BYTES,
  createCspReportRoute,
  cspReportRoute,
} from './cspReport.ts';

const post = (body: string, headers: Record<string, string> = {}) =>
  cspReportRoute({
    request: new Request('https://carlab.rs/api/csp-report', {
      method: 'POST',
      headers: { 'content-type': 'application/csp-report', ...headers },
      body,
    }),
  });

const logged = () => vi.mocked(console.info).mock.calls.map(([line]) => line);

afterEach(() => vi.restoreAllMocks());

describe('the CSP report route', () => {
  it('logs the directive and the blocked host of a report-uri report, nothing else', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await post(
      JSON.stringify({
        'csp-report': {
          'document-uri': 'https://carlab.rs/ru/parts/cart/?phone=0641112233',
          'violated-directive': 'script-src-elem',
          'effective-directive': 'script-src-elem',
          'blocked-uri': 'https://evil.example/x.js?vin=WBA35BG070N074158',
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(logged()).toEqual(['[csp] script-src-elem evil.example']);
  });

  it('reads Reporting API batches and names inline and eval blocks by keyword', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const response = await post(
      JSON.stringify([
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'script-src', blockedURL: 'inline' },
        },
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'script-src', blockedURL: 'eval' },
        },
        {
          type: 'csp-violation',
          body: {
            effectiveDirective: 'img-src',
            blockedURL: 'data:image/png;base64,AAAA',
          },
        },
        { type: 'csp-violation' },
        { type: 'deprecation', body: { id: 'x' } },
      ]),
      { 'content-type': 'application/reports+json' },
    );

    expect(response.status).toBe(204);
    expect(logged()).toEqual([
      '[csp] script-src inline',
      '[csp] script-src eval',
      '[csp] img-src data',
      '[csp] - -',
    ]);
  });

  it('falls back to the violated directive and keeps an unparsable blocked uri out of the log', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await post(
      JSON.stringify({
        'csp-report': { 'violated-directive': 'img-src', 'blocked-uri': '' },
      }),
    );

    expect(logged()).toEqual(['[csp] img-src -']);
  });

  it('answers 400 to a body that is not a report, and logs nothing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    expect((await post('{"name":"x"}')).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
    expect(logged()).toEqual([]);
  });

  it('refuses a body over the cap', async () => {
    const response = await post('x'.repeat(CSP_REPORT_MAX_BYTES + 1));
    expect(response.status).toBe(413);
  });

  it('hands each logged violation, and nothing more, to the callback', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const onViolation = vi.fn();
    const route = createCspReportRoute(onViolation);

    await route({
      request: new Request('https://carlab.rs/api/csp-report', {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report' },
        body: JSON.stringify({
          'csp-report': {
            'effective-directive': 'script-src-elem',
            'blocked-uri': 'https://evil.example/x.js?phone=0641112233',
          },
        }),
      }),
    });
    await route({
      request: new Request('https://carlab.rs/api/csp-report', {
        method: 'POST',
        body: 'not json',
      }),
    });

    expect(onViolation.mock.calls).toEqual([
      [{ directive: 'script-src-elem', blocked: 'evil.example' }],
    ]);
  });
});
