import type { ImageMetadata } from 'astro';
import wide from '@/assets/mechanic-engine-teardown-wide.jpg';
import type { Work } from '@/utils/works';

type Over = Partial<Work['data']> & { id?: string; body?: string };

export const work = ({ id = 'bmw-x3', body = '', ...data }: Over = {}) =>
  ({
    id,
    body,
    collection: 'works',
    data: {
      title: 'Замена масла',
      car: 'BMW X3',
      year: 2021,
      servicesApplied: ['servicing'],
      parts: [],
      image: wide,
      gallery: [],
      date: new Date('2026-09-15'),
      published: true,
      featured: false,
      ...data,
    },
  }) as unknown as Work;

export const BUILT_COVER = {
  src: '/_astro/cover_360.webp',
  srcset: '/_astro/cover_360.webp 360w, /_astro/cover_1080.webp 1080w',
  width: 1080,
  height: 810,
};

export const withBuiltCover = async (
  original: () => Promise<typeof import('@/utils/coverImages')>,
) => {
  const actual = await original();
  return {
    ...actual,
    builtCover: (image: ImageMetadata) =>
      actual.builtCover(image, Promise.resolve({ [wide.src]: BUILT_COVER })),
  };
};
