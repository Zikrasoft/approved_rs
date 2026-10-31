export const prerender = false;

import type { APIContext } from 'astro';
import {
  galleryImageType,
  galleryPhotoSchema,
  KEYSTATIC_AUTH_COOKIE,
} from '@/utils/adminGallery';
import { getGithubFileBuffer, GithubApiError } from '@/lib/githubContents';

export async function GET({ request, cookies }: APIContext): Promise<Response> {
  const query = galleryPhotoSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return new Response('Bad request', { status: 400 });
  const { dir, slug, file } = query.data;
  const contentType = galleryImageType(file);
  if (!contentType) {
    return new Response('Unsupported type', { status: 400 });
  }

  const relPath = `${dir}/${slug}/gallery/${file}`;

  if (import.meta.env.PROD) {
    const token = cookies.get(KEYSTATIC_AUTH_COOKIE)?.value;
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      const buffer = await getGithubFileBuffer(token, relPath);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=300',
        },
      });
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) {
        return new Response('Not found', { status: 404 });
      }
      throw err;
    }
  }

  return readLocalPhoto(relPath, contentType);
}

async function readLocalPhoto(
  relPath: string,
  contentType: string,
): Promise<Response> {
  if (import.meta.env.DEV) {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    try {
      const buffer = await readFile(path.join(process.cwd(), relPath));
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=300',
        },
      });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Response('Not found', { status: 404 });
      }
      throw err;
    }
  }
  return new Response('Not found', { status: 404 });
}
