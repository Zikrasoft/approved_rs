import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const HERO_WIDTHS = [480, 768, 1024, 1440, 1920];

export const HERO_SIZES = '100vw';

export interface HeroImageAttrs {
  src: string;
  srcset: string;
  sizes: string;
  width: number | undefined;
  height: number | undefined;
}

export async function heroImageAttrs(
  src: ImageMetadata,
): Promise<HeroImageAttrs> {
  const image = await getImage({
    src,
    format: 'webp',
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
