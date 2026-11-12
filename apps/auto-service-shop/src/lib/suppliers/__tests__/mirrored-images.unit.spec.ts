import { createServer, type Server } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';

import type { Logger, MedusaContainer } from '@medusajs/framework/types';

import { memoryStorage } from '../../../../integration-tests/fakeStorage';
import { parseEnv } from '../../env';
import { mirroredImage } from '../mirrored-images';

const toLoopback: LookupFunction = (_hostname, options, callback) =>
  options.all
    ? callback(null, [{ address: '127.0.0.1', family: 4 }])
    : callback(null, '127.0.0.1', 4);

const scope = {
  hasRegistration: () => true,
  resolve: () => toLoopback,
} as unknown as MedusaContainer;

const logger = { warn: jest.fn() } as unknown as Logger;

describe('mirroredImage', () => {
  let server: Server;
  let origin: string;
  const fetched: string[] = [];
  const userAgents: (string | undefined)[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      fetched.push(request.url!);
      userAgents.push(request.headers['user-agent']);
      if (request.url!.startsWith('/missing')) {
        response.writeHead(403).end();
        return;
      }
      const type = request.url === '/a.svg' ? 'image/svg+xml' : 'image/png';
      response.writeHead(200, { 'content-type': `${type}; charset=binary` });
      response.end('<svg onload="alert(1)"/>');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    origin = `http://images.brand.test:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('stores a raster image under its bare type and refuses an SVG', async () => {
    const { storage, images } = memoryStorage();

    const png = await mirroredImage(scope, storage, `${origin}/a.png`, logger);
    const svg = await mirroredImage(scope, storage, `${origin}/a.svg`, logger);

    expect(png).toMatch(/^supplier-images\/[0-9a-f]{64}$/);
    expect(svg).toBeNull();
    expect(
      [...images.objects.values()].map(({ contentType }) => contentType),
    ).toEqual(['image/png', 'text/plain']);
  });

  it('answers a source it copied before with the same key, without fetching it again', async () => {
    const { storage, images } = memoryStorage();
    const first = await mirroredImage(
      scope,
      storage,
      `${origin}/b.png`,
      logger,
    );

    const again = await mirroredImage(
      scope,
      storage,
      `${origin}/b.png`,
      logger,
    );

    expect(again).toBe(first);
    expect(fetched.filter((url) => url === '/b.png')).toEqual(['/b.png']);
    expect(images.objects.size).toBe(2);
  });

  it('keys an image already on the public host instead of fetching it', async () => {
    const { storage, images } = memoryStorage();
    const { FILE_URL } = parseEnv(process.env);

    expect(
      await mirroredImage(
        scope,
        storage,
        `${FILE_URL}/demo-supplier/ic-1001.webp`,
        logger,
      ),
    ).toBe('demo-supplier/ic-1001.webp');
    expect(images.objects.size).toBe(0);
  });

  it('asks for an image as a named client, as CDNs refuse a request without a user agent', async () => {
    const { storage } = memoryStorage();

    await mirroredImage(scope, storage, `${origin}/ua.png`, logger);

    expect(userAgents[userAgents.length - 1]).toMatch(/carlab\.rs/u);
  });

  it('remembers a source it could not copy and asks for it again only a week later', async () => {
    const { storage } = memoryStorage();
    const source = `${origin}/missing-a.png`;
    const now = Date.now();
    const at = jest.spyOn(Date, 'now');

    try {
      at.mockReturnValue(now);
      expect(await mirroredImage(scope, storage, source, logger)).toBeNull();
      at.mockReturnValue(now + 6 * 24 * 3600 * 1000);
      expect(await mirroredImage(scope, storage, source, logger)).toBeNull();
      at.mockReturnValue(now + 7 * 24 * 3600 * 1000 + 1);
      expect(await mirroredImage(scope, storage, source, logger)).toBeNull();
    } finally {
      at.mockRestore();
    }

    expect(fetched.filter((url) => url === '/missing-a.png')).toHaveLength(2);
  });
});
