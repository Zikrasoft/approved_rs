import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { publishedEntries } from '@podbor/i18n';
import {
  COVER_WIDTH_SETS,
  coverKey,
  optimizedCover,
} from '@/utils/coverImages';
import { publishedWorks } from '@/utils/works';

export const GET: APIRoute = async () => {
  const images = [
    ...publishedWorks(await getCollection('works')).map(
      ({ data }) => data.image,
    ),
    ...publishedEntries(await getCollection('articles')).map(
      ({ data }) => data.image,
    ),
  ];
  return Response.json(
    Object.fromEntries(
      await Promise.all(
        images.flatMap((image) =>
          COVER_WIDTH_SETS.map(
            async (widths) =>
              [
                coverKey(image, widths),
                await optimizedCover(image, widths),
              ] as const,
          ),
        ),
      ),
    ),
  );
};
