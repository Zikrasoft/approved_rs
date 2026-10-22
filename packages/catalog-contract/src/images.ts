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
