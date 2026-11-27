import type { Logger } from '@medusajs/framework/types';
import sharp from 'sharp';

import { memoryStorage } from '../../../../integration-tests/fakeStorage';
import { supplierPicture } from '../mirrored-images';

const logger = { warn: jest.fn() } as unknown as Logger;

const KEY = 'supplier-images/abc';

const jpeg = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#888888' },
  })
    .jpeg()
    .toBuffer();

const stored = async (body: Buffer) => {
  const store = memoryStorage();
  await store.storage.images.put(KEY, body, { contentType: 'image/jpeg' });
  return store;
};

describe('supplierPicture', () => {
  it('writes WebP copies 160, 480 and 960 px wide beside the original and answers their keys and sizes', async () => {
    const { storage, images } = await stored(await jpeg(1280, 687));

    const picture = await supplierPicture(storage, KEY, logger);

    expect(picture).toEqual({
      src: `${KEY}-960.webp`,
      width: 960,
      height: 515,
      srcset: [
        { url: `${KEY}-160.webp`, width: 160 },
        { url: `${KEY}-480.webp`, width: 480 },
        { url: `${KEY}-960.webp`, width: 960 },
      ],
    });
    const copy = images.objects.get(`${KEY}-160.webp`)!;
    expect(copy.contentType).toBe('image/webp');
    expect((await sharp(copy.body).metadata()).format).toBe('webp');
  });

  it('never enlarges a small image, keeping one copy per distinct width', async () => {
    const { storage } = await stored(await jpeg(300, 300));

    expect(await supplierPicture(storage, KEY, logger)).toEqual({
      src: `${KEY}-300.webp`,
      width: 300,
      height: 300,
      srcset: [
        { url: `${KEY}-160.webp`, width: 160 },
        { url: `${KEY}-300.webp`, width: 300 },
      ],
    });
  });

  it('answers an image it sized before from its record, without resizing it again', async () => {
    const { storage, images } = await stored(await jpeg(1280, 687));
    const first = await supplierPicture(storage, KEY, logger);
    images.objects.delete(KEY);

    expect(await supplierPicture(storage, KEY, logger)).toEqual(first);
  });

  it('answers null and logs for an original it cannot decode or find, and tries again next time', async () => {
    const { storage, images } = await stored(Buffer.from('not an image'));

    expect(await supplierPicture(storage, KEY, logger)).toBeNull();
    expect(await supplierPicture(storage, 'missing', logger)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(KEY));
    await storage.images.put(KEY, await jpeg(200, 100), {
      contentType: 'image/jpeg',
    });
    expect((await supplierPicture(storage, KEY, logger))?.width).toBe(200);
    expect(images.objects.has(`${KEY}.json`)).toBe(true);
  });
});
