import { getImage } from 'astro:assets';
import { coverScale, coverSizes } from './coverSizes';
import type { Photo } from './works';

const INSET_SIZES =
  '(min-width: 1224px) 508px, (min-width: 1024px) calc(46.5vw - 43px)';
const BANNER_SIZES = 'calc(100vw - 2.5rem)';

export const panelPhoto = async ({ image, alt }: Photo) => {
  const sizes = `${coverSizes(INSET_SIZES, coverScale(image, 4 / 3))}, ${BANNER_SIZES}`;
  const { src, srcSet } = await getImage({
    src: image,
    widths: [480, 720, 1080, 1280, 1920],
    sizes,
    format: 'webp',
  });
  return {
    src,
    srcset: srcSet.attribute,
    sizes,
    width: image.width,
    height: image.height,
    alt,
  };
};

export type PanelPhoto = Awaited<ReturnType<typeof panelPhoto>>;
