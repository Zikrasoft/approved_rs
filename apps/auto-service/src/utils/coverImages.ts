import { readFile } from 'node:fs/promises';
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { z } from 'zod';

export const COVER_IMAGES_FILE = 'cover-images.json';

const coverImageSchema = z.object({
  src: z.string(),
  srcset: z.string(),
  width: z.number(),
  height: z.number(),
});

const coverImagesSchema = z.record(z.string(), coverImageSchema);

export type CoverImage = z.infer<typeof coverImageSchema>;

type CoverImages = z.infer<typeof coverImagesSchema>;

export async function optimizedCover(
  image: ImageMetadata,
): Promise<CoverImage> {
  const { src, srcSet, attributes } = await getImage({
    src: image,
    widths: [360, 560, 760, 1080],
    quality: 68,
  });
  return {
    src,
    srcset: srcSet.attribute,
    width: Number(attributes.width),
    height: Number(attributes.height),
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
  images = (built ??= readCoverImages(import.meta.url)),
): Promise<CoverImage> {
  const found = (await images)?.[image.src];
  if (found) return found;
  if (import.meta.env.DEV) return optimizedCover(image);
  throw new Error(
    `${image.src} has no optimized cover in ${COVER_IMAGES_FILE}`,
  );
}
