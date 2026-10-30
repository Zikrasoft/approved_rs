import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  CONTENT_REPO,
  createGithubContents,
} from '@podbor/site-kit/github-contents';

export { GithubApiError } from '@podbor/site-kit/github-contents';

const github = createGithubContents({
  ...CONTENT_REPO,
  appRoot: 'apps/approved-rs/',
  userAgent: 'approved-rs-admin',
});

export const {
  listDir: listGithubDir,
  getFile: getGithubFile,
  getFileBuffer: getGithubFileBuffer,
} = github;

export async function listGalleryFiles(
  token: string | undefined,
  relDir: string,
): Promise<string[]> {
  if (import.meta.env.PROD) {
    if (!token) return [];
    try {
      return await listGithubDir(token, relDir);
    } catch (err) {
      console.error('listGalleryFiles: failed to list', relDir, err);
      return [];
    }
  }
  const dir = path.join(process.cwd(), relDir);
  return existsSync(dir) ? await readdir(dir) : [];
}

export const commitGalleryPhotos = (
  token: string,
  opts: {
    photos: { path: string; base64: string }[];
    indexPath: string;
    indexContent: string;
    message: string;
  },
) =>
  github.commitFiles(token, {
    files: [
      ...opts.photos,
      { path: opts.indexPath, content: opts.indexContent },
    ],
    message: opts.message,
  });
