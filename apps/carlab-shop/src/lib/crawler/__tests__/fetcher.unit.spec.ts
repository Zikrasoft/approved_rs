import { existsSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';

import { chromium } from 'playwright';

import { crawleeFetcher, type Fetcher, type FetchMode } from '../fetcher';

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  hit: number,
) => void;

const site = async (routes: Record<string, Handler>) => {
  const hits: Record<string, IncomingMessage[]> = {};
  const server = createServer((request, response) => {
    const path = request.url ?? '/';
    hits[path] = [...(hits[path] ?? []), request];
    const route = routes[path];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    route(request, response, hits[path].length);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    hits: (path: string) => hits[path] ?? [],
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

const html = (body: string, status = 200, headers = {}): Handler => {
  return (_request, response) =>
    response
      .writeHead(status, { 'content-type': 'text/html', ...headers })
      .end(body);
};

describe('crawleeFetcher', () => {
  let fetcher: Fetcher;
  let web: Awaited<ReturnType<typeof site>>;
  let attempts: number;
  const open = (mode: FetchMode = 'http') => {
    fetcher = crawleeFetcher(mode);
    return fetcher;
  };
  const get = (path: string, headers?: Record<string, string>) =>
    fetcher.fetch({
      url: web.url(path),
      headers,
      beforeAttempt: async () => {
        attempts += 1;
      },
    });

  beforeEach(() => {
    attempts = 0;
  });

  afterEach(async () => {
    await fetcher?.close();
    await web?.close();
  });

  it('sends browser-like headers and hands back the status, headers and raw body', async () => {
    const sitemap = gzipSync('<urlset></urlset>');
    web = await site({
      '/p/1': html('<html>one</html>', 200, { etag: '"1"' }),
      '/sitemap.xml.gz': (_request, response) =>
        response
          .writeHead(200, { 'content-type': 'application/x-gzip' })
          .end(sitemap),
    });
    open();

    const page = await get('/p/1', {
      from: 'crawler@carlab.test',
      'if-none-match': '"0"',
    });
    const gz = await get('/sitemap.xml.gz');

    expect(page).toEqual({
      kind: 'response',
      status: 200,
      headers: expect.objectContaining({ etag: '"1"' }),
      body: Buffer.from('<html>one</html>'),
    });
    expect(gz).toMatchObject({ kind: 'response', body: sitemap });
    const [request] = web.hits('/p/1');
    expect(request.headers['user-agent']).toMatch(/^Mozilla\/5\.0 /u);
    expect(request.headers['accept-language']).toBeTruthy();
    expect(request.headers.from).toBe('crawler@carlab.test');
    expect(request.headers['if-none-match']).toBe('"0"');
    expect(attempts).toBe(2);
  });

  it('hands a 404, a 429 and a 503 back once, without retrying them itself', async () => {
    web = await site({
      '/busy': html('', 429, { 'retry-after': '120' }),
      '/down': html('', 503),
    });
    open();

    const missing = await get('/gone');
    const busy = await get('/busy');
    const down = await get('/down');

    expect(missing).toMatchObject({ kind: 'response', status: 404 });
    expect(busy).toMatchObject({
      kind: 'response',
      status: 429,
      headers: expect.objectContaining({ 'retry-after': '120' }),
    });
    expect(down).toMatchObject({ kind: 'response', status: 503 });
    expect(web.hits('/busy')).toHaveLength(1);
    expect(web.hits('/down')).toHaveLength(1);
  });

  it('retries a 403 under a fresh session before every attempt, then reports the page blocked', async () => {
    web = await site({ '/p/1': html('no', 403) });
    open();

    const fetched = await get('/p/1');

    expect(fetched).toMatchObject({ kind: 'blocked' });
    expect(web.hits('/p/1')).toHaveLength(4);
    expect(attempts).toBe(4);
  });

  it('gets the page once a retry is let through', async () => {
    web = await site({
      '/p/1': (request, response, hit) =>
        html(hit === 1 ? 'no' : 'yes', hit === 1 ? 403 : 200)(
          request,
          response,
          hit,
        ),
    });
    open();

    const fetched = await get('/p/1');

    expect(fetched).toMatchObject({ kind: 'response', status: 200 });
    expect(web.hits('/p/1')).toHaveLength(2);
  });

  it('reports a challenge page as blocked instead of handing it back', async () => {
    web = await site({
      '/p/1': html('<html><head><title>Just a moment...</title></head></html>'),
    });
    open();

    const fetched = await get('/p/1');

    expect(fetched).toMatchObject({ kind: 'blocked' });
    expect(web.hits('/p/1').length).toBeGreaterThan(1);
  });

  it('reports a host that does not answer as an error', async () => {
    web = await site({});
    const url = web.url('/p/1');
    await web.close();
    open();

    const fetched = await fetcher.fetch({
      url,
      beforeAttempt: async () => {},
    });

    expect(fetched).toMatchObject({ kind: 'error' });
  });

  const withBrowser = existsSync(chromium.executablePath()) ? it : it.skip;

  withBrowser(
    'retries a 403 in the browser too, then reports it blocked',
    async () => {
      web = await site({ '/p/1': html('no', 403) });
      open('browser');

      const fetched = await get('/p/1');

      expect(fetched).toMatchObject({ kind: 'blocked' });
      expect(web.hits('/p/1')).toHaveLength(4);
    },
  );

  withBrowser('renders a page through the browser', async () => {
    web = await site({
      '/p/1': html(
        '<html><body><script>document.body.dataset.rendered = "yes"</script></body></html>',
      ),
    });
    open('browser');

    const fetched = await get('/p/1');

    expect(fetched).toMatchObject({ kind: 'response', status: 200 });
    expect(
      fetched.kind === 'response' && fetched.body.toString('utf8'),
    ).toContain('data-rendered="yes"');
    expect(attempts).toBe(1);
  });

  withBrowser(
    'waits for what the site names before handing the page back',
    async () => {
      web = await site({
        '/p/1': html(
          '<html><body><script>setTimeout(() => { const late = document.createElement("table"); late.id = "late"; document.body.append(late) }, 300)</script></body></html>',
        ),
      });
      open('browser');

      const fetched = await fetcher.fetch({
        url: web.url('/p/1'),
        waitFor: '#late',
        beforeAttempt: async () => {},
      });

      expect(
        fetched.kind === 'response' && fetched.body.toString('utf8'),
      ).toContain('<table id="late">');
    },
  );
});
