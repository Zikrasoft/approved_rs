import { z } from 'zod';

export const imageSchema = z.object({
  src: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  srcset: z.array(
    z.object({ url: z.url(), width: z.number().int().positive() }),
  ),
});

export type Image = z.infer<typeof imageSchema>;

export const smallestImage = (image: Image): string =>
  image.srcset[0]?.url ?? image.src;

const SUPPLIER_IMAGE_SIZE = 800;

export const supplierImage = (url: string): Image => ({
  src: url,
  width: SUPPLIER_IMAGE_SIZE,
  height: SUPPLIER_IMAGE_SIZE,
  srcset: [],
});
