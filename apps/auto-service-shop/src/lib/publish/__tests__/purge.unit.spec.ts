import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { cachePurge } from '../purge';

describe('cachePurge', () => {
  let server: Server;
  let endpoint: string;
  const received: { method?: string; url?: string }[] = [];
  let status = 204;

  beforeAll(async () => {
    server = createServer((request, response) => {
      received.push({ method: request.method, url: request.url });
      response.writeHead(status).end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/souin-api/souin`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    received.length = 0;
    status = 204;
  });

  it('sends the pattern as a PURGE on the path, unescaped', async () => {
    await cachePurge(endpoint)('-/[a-z][a-z]/parts/$');

    expect(received).toEqual([
      { method: 'PURGE', url: '/souin-api/souin/-/[a-z][a-z]/parts/$' },
    ]);
  });

  it('fails when the cache refuses', async () => {
    status = 403;

    await expect(cachePurge(endpoint)('sitemap')).rejects.toThrow(
      'The page cache refused the purge of sitemap: 403 Forbidden',
    );
  });

  it('purges nothing without an endpoint', async () => {
    await cachePurge(undefined)('sitemap');

    expect(received).toEqual([]);
  });
});
