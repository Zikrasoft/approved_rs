export const prerender = false;

import type { APIContext } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isKnownCaseDir, isValidSlug, KEYSTATIC_AUTH_COOKIE, SAFE_GALLERY_FILENAME } from '@/utils/adminGallery';
import { getGithubFileBuffer, GithubApiError } from '@/lib/githubContents';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

// Serves one gallery photo back to the admin/case-photos.astro preview grid.
// Dev reads straight off disk (same fs case-photos-upload.ts writes to);
// prod fetches it from GitHub through the same auth-cookie gate as the rest
// of this tool, since Vercel's fs never has these files.
export async function GET({ request, cookies }: APIContext): Promise<Response> {
  const url = new URL(request.url);
  const dir = url.searchParams.get('dir') ?? '';
  const slug = url.searchParams.get('slug') ?? '';
  const file = url.searchParams.get('file') ?? '';

  if (!isKnownCaseDir(dir) || !isValidSlug(slug) || !SAFE_GALLERY_FILENAME.test(file)) {
    return new Response('Bad request', { status: 400 });
  }
  const ext = file.slice(file.lastIndexOf('.') + 1);
  const contentType = MIME_BY_EXT[ext];
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
      return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' } });
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) {
        return new Response('Not found', { status: 404 });
      }
      throw err;
    }
  }

  try {
    const buffer = await readFile(path.join(process.cwd(), relPath));
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' } });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Response('Not found', { status: 404 });
    }
    throw err;
  }
}
