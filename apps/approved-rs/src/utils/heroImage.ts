import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export const IMAGE_QUALITY = 65;

const LIGHTBOX_WIDTH = 1600;
const SHARE_WIDTH = 1200;
const SHARE_QUALITY = 60;
const HERO_WIDTHS = [480, 768, 1024, 1440, 1920];

export const HERO_SIZES = '100vw';

export interface HeroImageAttrs {
  src: string;
  srcset: string;
  sizes: string;
  width: number | undefined;
  height: number | undefined;
}

export async function lightboxSrc(src: ImageMetadata): Promise<string> {
  const image = await getImage({
    src,
    format: 'webp',
    quality: IMAGE_QUALITY,
    width: LIGHTBOX_WIDTH,
  });
  return image.src;
}

export async function shareImage(
  src: ImageMetadata,
): Promise<{ src: string; width: number; height: number }> {
  const image = await getImage({
    src,
    format: 'jpeg',
    quality: SHARE_QUALITY,
    width: SHARE_WIDTH,
  });
  return {
    src: image.src,
    width: Number(image.attributes.width),
    height: Number(image.attributes.height),
  };
}

export async function heroImageAttrs(
  src: ImageMetadata,
): Promise<HeroImageAttrs> {
  const image = await getImage({
    src,
    format: 'webp',
    quality: IMAGE_QUALITY,
    widths: HERO_WIDTHS,
    sizes: HERO_SIZES,
  });
  return {
    src: image.src,
    srcset: image.srcSet.attribute,
    sizes: HERO_SIZES,
    width: Number(image.attributes.width) || undefined,
    height: Number(image.attributes.height) || undefined,
  };
}
