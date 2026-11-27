import { readFile } from 'node:fs/promises';
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { z } from 'zod';

export const COVER_IMAGES_FILE = 'cover-images.json';

const coverImageSchema = z.object({
  src: z.string(),
  srcset: z.string(),
  avifSrcset: z.string(),
  width: z.number(),
  height: z.number(),
});

const coverImagesSchema = z.record(z.string(), coverImageSchema);

export type CoverImage = z.infer<typeof coverImageSchema>;

type CoverImages = z.infer<typeof coverImagesSchema>;

export const IMAGE_QUALITY = 68;

export const AVIF_QUALITY = 50;

export const COVER_WIDTHS = [360, 560, 760, 1080];

export const MAKE_COVER_WIDTHS = [240, 360, 560];

export const COVER_WIDTH_SETS = [COVER_WIDTHS, MAKE_COVER_WIDTHS];

export const coverKey = (image: ImageMetadata, widths: number[]) =>
  `${widths.join(',')}:${image.src}`;

export async function optimizedCover(
  image: ImageMetadata,
  widths = COVER_WIDTHS,
): Promise<CoverImage> {
  const [webp, avif] = await Promise.all([
    getImage({ src: image, widths, quality: IMAGE_QUALITY }),
    getImage({
      src: image,
      widths,
      format: 'avif',
      quality: AVIF_QUALITY,
    }),
  ]);
  return {
    src: webp.src,
    srcset: webp.srcSet.attribute,
    avifSrcset: avif.srcSet.attribute,
    width: Number(webp.attributes.width),
    height: Number(webp.attributes.height),
  };
}

const isMissing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export async function readCoverImages(
  from: string | URL,
): Promise<CoverImages | null> {
  for (let dir = new URL('./', from); ; dir = new URL('../', dir)) {
    try {
      return coverImagesSchema.parse(
        JSON.parse(
          await readFile(new URL(`client/${COVER_IMAGES_FILE}`, dir), 'utf8'),
        ),
      );
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (dir.pathname === '/') return null;
  }
}

let built: Promise<CoverImages | null> | undefined;

export async function builtCover(
  image: ImageMetadata,
  widths = COVER_WIDTHS,
  images = (built ??= readCoverImages(import.meta.url)),
): Promise<CoverImage> {
  const found = (await images)?.[coverKey(image, widths)];
  if (found) return found;
  if (import.meta.env.DEV) return optimizedCover(image, widths);
  throw new Error(
    `${image.src} has no optimized cover in ${COVER_IMAGES_FILE}`,
  );
}

export const coverUrl = ({ srcset }: CoverImage, width: number) =>
  srcset
    .split(', ')
    .map((entry) => entry.split(' '))
    .find(([, descriptor]) => descriptor === `${width}w`)?.[0];
