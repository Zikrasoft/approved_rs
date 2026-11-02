import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const SIZES =
  '(min-width: 1224px) 508px, (min-width: 1024px) calc(46.5vw - 43px), calc(100vw - 2.5rem)';

export const panelPhoto = async (image: ImageMetadata) => {
  const { src, srcSet } = await getImage({
    src: image,
    widths: [480, 720, 1080, 1280],
    sizes: SIZES,
    format: 'webp',
  });
  return {
    src,
    srcset: srcSet.attribute,
    sizes: SIZES,
    width: image.width,
    height: image.height,
  };
};

export type PanelPhoto = Awaited<ReturnType<typeof panelPhoto>>;
