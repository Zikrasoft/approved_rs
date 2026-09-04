export const prerender = false;

import type { APIContext } from 'astro';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isKnownCaseDir, isValidSlug, sanitizeFilename, dedupeFilename, appendGalleryEntries, KEYSTATIC_AUTH_COOKIE } from '@/utils/adminGallery';
import { listGithubDir, getGithubFile, commitGalleryPhotos, GithubApiError } from '@/lib/githubContents';

// Guards against an accidentally-huge upload wedging the serverless
// function (base64-encoded whole into one JSON POST body before GitHub's
// blob API gets a chance to reject it) — not a hard content limit, just a
// sanity cap. `accept="image/*"` on the client is trivially bypassable, so
// this is the only real check.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function backToForm(request: Request, dir: string, slug: string, extra: Record<string, string>): Response {
  return Response.redirect(new URL(`/admin/case-photos?${new URLSearchParams({ dir, slug, ...extra })}`, request.url), 303);
}

// Dev writes straight to disk (same as Keystatic's own local storage mode);
// prod commits via GitHub's API instead (src/lib/githubContents.ts) — see
// admin/case-photos.astro's doc comment for why, and for the auth-cookie
// gate this shares with the page.
export async function POST({ request, cookies }: APIContext): Promise<Response> {
  const token = cookies.get(KEYSTATIC_AUTH_COOKIE)?.value;
  if (import.meta.env.PROD && !token) {
    return new Response('Открой эту страницу через Keystatic', { status: 401 });
  }

  const form = await request.formData();
  const dir = form.get('dir')?.toString() ?? '';
  const slug = form.get('slug')?.toString() ?? '';
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);

  if (!isKnownCaseDir(dir) || !isValidSlug(slug)) {
    return new Response('Bad collection/slug', { status: 400 });
  }
  if (files.some(f => f.size > MAX_PHOTO_BYTES)) {
    return new Response('File too large', { status: 413 });
  }
  if (files.length === 0) {
    return backToForm(request, dir, slug, { error: 'no-files' });
  }

  const indexRelPath = `${dir}/${slug}/index.md`;
  const galleryRelDir = `${dir}/${slug}/gallery`;

  if (import.meta.env.PROD) {
    const taken = new Set(await listGithubDir(token!, galleryRelDir));
    const photos: { path: string; base64: string }[] = [];
    const newRelPaths: string[] = [];
    for (const file of files) {
      const filename = dedupeFilename(sanitizeFilename(file.name), taken);
      taken.add(filename);
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
      photos.push({ path: `${galleryRelDir}/${filename}`, base64 });
      newRelPaths.push(`gallery/${filename}`);
    }

    let indexContent: string;
    try {
      indexContent = await getGithubFile(token!, indexRelPath);
    } catch (err) {
      // Only a real 404 means "no such case" — an auth/network/5xx failure
      // here must propagate instead of being reported as "not found".
      if (err instanceof GithubApiError && err.status === 404) {
        return new Response('Case not found', { status: 404 });
      }
      throw err;
    }

    await commitGalleryPhotos(token!, {
      photos,
      indexPath: indexRelPath,
      indexContent: appendGalleryEntries(indexContent, newRelPaths),
      message: `Add ${newRelPaths.length} gallery photo(s) to ${slug}`,
    });

    return backToForm(request, dir, slug, { ok: String(newRelPaths.length) });
  }

  const caseDir = path.join(process.cwd(), dir, slug);
  const indexPath = path.join(caseDir, 'index.md');
  if (!existsSync(indexPath)) {
    return new Response('Case not found', { status: 404 });
  }

  const galleryDir = path.join(caseDir, 'gallery');
  await mkdir(galleryDir, { recursive: true });
  const taken = new Set(await readdir(galleryDir));

  const newRelPaths: string[] = [];
  for (const file of files) {
    const filename = dedupeFilename(sanitizeFilename(file.name), taken);
    taken.add(filename);
    await writeFile(path.join(galleryDir, filename), Buffer.from(await file.arrayBuffer()));
    newRelPaths.push(`gallery/${filename}`);
  }

  const raw = await readFile(indexPath, 'utf-8');
  await writeFile(indexPath, appendGalleryEntries(raw, newRelPaths));

  return backToForm(request, dir, slug, { ok: String(newRelPaths.length) });
}
