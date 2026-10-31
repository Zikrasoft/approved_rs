import { createServer, type Server } from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';

import type { Logger, MedusaContainer } from '@medusajs/framework/types';

import { memoryStorage } from '../../../../integration-tests/fakeStorage';
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

  beforeAll(async () => {
    server = createServer((request, response) => {
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

    expect(png).toEqual(expect.stringContaining('supplier-images/'));
    expect(svg).toBeNull();
    expect(
      [...images.objects.values()].map(({ contentType }) => contentType),
    ).toEqual(['image/png', 'text/plain']);
  });
});
