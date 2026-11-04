import { getImage } from 'astro:assets';
import { coverScale, coverSizes } from './coverSizes';
import type { Photo } from './works';

const BANNER_SIZES = 'calc(100vw - 2.5rem)';

const photoIn =
  (columnSizes: string, columnAspect: number) =>
  async ({ image, alt }: Photo) => {
    const sizes = `${coverSizes(columnSizes, coverScale(image, columnAspect))}, ${BANNER_SIZES}`;
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

export const panelPhoto = photoIn(
  '(min-width: 1224px) 532px, (min-width: 1024px) calc(46.5vw - 19px)',
  3 / 4,
);

export const visitPhoto = photoIn(
  '(min-width: 1224px) 572px, (min-width: 1024px) calc(50vw - 20px)',
  1,
);

export type PanelPhoto = Awaited<ReturnType<typeof panelPhoto>>;
