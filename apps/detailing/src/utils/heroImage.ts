import { getImage } from 'astro:assets';
import heroSource from '@/content/works/mersedes-benz-gls/image.jpg';

export const HERO_SIZES = '100vw';

export const HERO_WIDTH = heroSource.width;
export const HERO_HEIGHT = heroSource.height;

// TODO: the master is 960x1280, so Astro clamps the srcset at 960w and every
// viewport wider than ~960 CSS px still gets an upscaled LCP image. The 1440
// and 1920 candidates below only start emitting once a larger master lands.
export const getHeroPicture = () =>
  getImage({
    src: heroSource,
    widths: [640, 768, 960, 1440, 1920],
    sizes: HERO_SIZES,
    format: 'webp',
    quality: 70,
  });
