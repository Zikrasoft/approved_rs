import { z } from 'zod';

export const KEYSTATIC_AUTH_COOKIE = 'keystatic-gh-access-token';

const API = 'https://api.github.com';

export class GithubApiError extends Error {
  status: number;

  constructor(status: number, path: string, body: string) {
    super(`GitHub API ${path} failed: ${status} ${body}`);
    this.status = status;
  }
}

export type GithubFile =
  { path: string; base64: string } | { path: string; content: string };

export interface GithubContentsOptions {
  repo: string;
  branch: string;
  appRoot: string;
  userAgent: string;
}

const shaSchema = z.object({ sha: z.string().min(1) });

export function createGithubContents({
  repo,
  branch,
  appRoot,
  userAgent,
}: GithubContentsOptions) {
  const repoPath = (relPath: string) => `${appRoot}${relPath}`;

  async function ghFetch<T>(
    schema: z.ZodType<T>,
    token: string,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(`${API}/repos/${repo}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': userAgent,
      },
    });
    if (!res.ok) throw new GithubApiError(res.status, path, await res.text());
    return schema.parse(await res.json());
  }

  const contentsPath = (relPath: string) =>
    `/contents/${repoPath(relPath)}?ref=${branch}`;

  async function listDir(token: string, dirPath: string): Promise<string[]> {
    try {
      const entries = await ghFetch(
        z.array(z.object({ name: z.string() })),
        token,
        contentsPath(dirPath),
      );
      return entries.map((e) => e.name);
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 404) return [];
      throw err;
    }
  }

  async function getFileBuffer(
    token: string,
    filePath: string,
  ): Promise<Buffer> {
    const data = await ghFetch(
      z.object({ content: z.string() }),
      token,
      contentsPath(filePath),
    );
    return Buffer.from(data.content, 'base64');
  }

  const getFile = async (token: string, filePath: string) =>
    (await getFileBuffer(token, filePath)).toString('utf-8');

  async function commitFiles(
    token: string,
    { files, message }: { files: GithubFile[]; message: string },
  ): Promise<void> {
    const ref = await ghFetch(
      z.object({ object: shaSchema }),
      token,
      `/git/ref/heads/${branch}`,
    );
    const baseCommitSha = ref.object.sha;
    const baseCommit = await ghFetch(
      z.object({ tree: shaSchema }),
      token,
      `/git/commits/${baseCommitSha}`,
    );

    const entries = await Promise.all(
      files.map(async (file) => {
        const entry = {
          path: repoPath(file.path),
          mode: '100644',
          type: 'blob',
        };
        if ('content' in file) return { ...entry, content: file.content };
        const blob = await ghFetch(shaSchema, token, '/git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content: file.base64, encoding: 'base64' }),
        });
        return { ...entry, sha: blob.sha };
      }),
    );

    const tree = await ghFetch(shaSchema, token, '/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
    });

    const commit = await ghFetch(shaSchema, token, '/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [baseCommitSha],
      }),
    });

    await ghFetch(z.unknown(), token, `/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });
  }

  async function canWrite(token: string): Promise<boolean> {
    try {
      const { permissions } = await ghFetch(
        z.object({ permissions: z.object({ push: z.boolean() }) }),
        token,
        '',
      );
      return permissions.push;
    } catch (err) {
      if (err instanceof GithubApiError && [401, 403, 404].includes(err.status))
        return false;
      throw err;
    }
  }

  return { listDir, getFile, getFileBuffer, commitFiles, canWrite };
}
