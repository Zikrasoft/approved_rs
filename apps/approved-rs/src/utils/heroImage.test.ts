import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageMetadata } from 'astro';

const getImage = vi.fn();
vi.mock('astro:assets', () => ({ getImage }));

const { HERO_SIZES, IMAGE_QUALITY, heroImageAttrs, lightboxSrc, shareImage } =
  await import('./heroImage');

const photo = {
  src: '/photo.jpg',
  width: 4000,
  height: 3000,
  format: 'jpg',
} as ImageMetadata;

beforeEach(() => getImage.mockReset());

describe('heroImageAttrs', () => {
  it('asks for a webp srcset at the shared quality and returns its attributes', async () => {
    getImage.mockResolvedValue({
      src: '/hero-1920.webp',
      srcSet: { attribute: '/hero-480.webp 480w, /hero-1920.webp 1920w' },
      attributes: { width: '1920', height: '1440' },
    });

    expect(await heroImageAttrs(photo)).toEqual({
      src: '/hero-1920.webp',
      srcset: '/hero-480.webp 480w, /hero-1920.webp 1920w',
      sizes: HERO_SIZES,
      width: 1920,
      height: 1440,
    });
    expect(getImage).toHaveBeenCalledWith(
      expect.objectContaining({
        src: photo,
        format: 'webp',
        quality: IMAGE_QUALITY,
        sizes: HERO_SIZES,
      }),
    );
  });

  it('leaves the dimensions out when the image service gives none', async () => {
    getImage.mockResolvedValue({
      src: '/hero.webp',
      srcSet: { attribute: '' },
      attributes: {},
    });

    const attrs = await heroImageAttrs(photo);

    expect(attrs.width).toBeUndefined();
    expect(attrs.height).toBeUndefined();
  });
});

describe('lightboxSrc', () => {
  it('serves a resized webp instead of the original photo', async () => {
    getImage.mockResolvedValue({ src: '/photo-1600.webp' });

    expect(await lightboxSrc(photo)).toBe('/photo-1600.webp');
    expect(getImage).toHaveBeenCalledWith({
      src: photo,
      format: 'webp',
      quality: IMAGE_QUALITY,
      width: 1600,
    });
  });
});

describe('shareImage', () => {
  it('serves a resized jpeg with its real dimensions for social previews', async () => {
    getImage.mockResolvedValue({
      src: '/photo-1200.jpg',
      attributes: { width: '1200', height: '900' },
    });

    expect(await shareImage(photo)).toEqual({
      src: '/photo-1200.jpg',
      width: 1200,
      height: 900,
    });
    expect(getImage).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg', width: 1200 }),
    );
  });
});
