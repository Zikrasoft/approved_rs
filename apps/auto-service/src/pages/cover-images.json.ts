import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { optimizedCover } from '@/utils/coverImages';
import { publishedWorks } from '@/utils/works';

export const GET: APIRoute = async () =>
  Response.json(
    Object.fromEntries(
      await Promise.all(
        publishedWorks(await getCollection('works')).map(
          async ({ data: { image } }) =>
            [image.src, await optimizedCover(image)] as const,
        ),
      ),
    ),
  );
