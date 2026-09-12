import { describe, it, expect, vi, afterEach } from 'vitest';
import type { APIContext } from 'astro';

vi.mock('@/lib/githubContents', () => ({
  getGithubFileBuffer: vi.fn(),
  GithubApiError: class GithubApiError extends Error {
    status: number;
    constructor(status: number, path: string, body: string) {
      super(`GitHub API ${path} failed: ${status} ${body}`);
      this.status = status;
    }
  },
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-bytes')),
}));

import { GET } from './case-photos-image';
import { getGithubFileBuffer, GithubApiError } from '@/lib/githubContents';
import { readFile } from 'node:fs/promises';

function makeCtx(
  opts: { dir?: string; slug?: string; file?: string; cookie?: string } = {},
): APIContext {
  const url = new URL('http://localhost/api/admin/case-photos-image');
  url.searchParams.set('dir', opts.dir ?? 'src/content/cases');
  url.searchParams.set('slug', opts.slug ?? 'bmw-320');
  url.searchParams.set('file', opts.file ?? 'photo.jpg');
  return {
    request: new Request(url),
    cookies: {
      get: (name: string) =>
        opts.cookie && name === 'keystatic-gh-access-token'
          ? { value: opts.cookie }
          : undefined,
    },
  } as unknown as APIContext;
}

describe('GET /api/admin/case-photos-image', () => {
  const originalProd = import.meta.env.PROD;

  afterEach(() => {
    import.meta.env.PROD = originalProd;
    vi.clearAllMocks();
  });

  it('rejects an unknown collection dir with 400', async () => {
    const res = await GET(makeCtx({ dir: 'src/content/nope' }));
    expect(res.status).toBe(400);
  });

  it('rejects a filename that does not look sanitized with 400', async () => {
    const res = await GET(makeCtx({ file: '../../etc/passwd' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported extension with 400', async () => {
    const res = await GET(makeCtx({ file: 'script.exe' }));
    expect(res.status).toBe(400);
  });

  it('dev: reads the file off disk and returns it with the right content type', async () => {
    import.meta.env.PROD = false;
    const res = await GET(makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(readFile).toHaveBeenCalledWith(
      expect.stringContaining('src/content/cases/bmw-320/gallery/photo.jpg'),
    );
  });

  it('prod: 401s without an auth cookie', async () => {
    import.meta.env.PROD = true;
    const res = await GET(makeCtx({ cookie: undefined }));
    expect(res.status).toBe(401);
    expect(getGithubFileBuffer).not.toHaveBeenCalled();
  });

  it('prod: fetches the file from GitHub when the cookie is present', async () => {
    import.meta.env.PROD = true;
    vi.mocked(getGithubFileBuffer).mockResolvedValue(
      Buffer.from('fake-image-bytes'),
    );
    const res = await GET(makeCtx({ cookie: 'gh-token' }));
    expect(res.status).toBe(200);
    expect(getGithubFileBuffer).toHaveBeenCalledWith(
      'gh-token',
      'src/content/cases/bmw-320/gallery/photo.jpg',
    );
  });

  it('prod: 404s when the file is missing on GitHub, instead of a raw 500', async () => {
    import.meta.env.PROD = true;
    vi.mocked(getGithubFileBuffer).mockRejectedValueOnce(
      new GithubApiError(404, 'x', 'not found'),
    );
    const res = await GET(makeCtx({ cookie: 'gh-token' }));
    expect(res.status).toBe(404);
  });

  it('prod: propagates a non-404 GitHub failure', async () => {
    import.meta.env.PROD = true;
    vi.mocked(getGithubFileBuffer).mockRejectedValueOnce(
      new GithubApiError(500, 'x', 'boom'),
    );
    await expect(GET(makeCtx({ cookie: 'gh-token' }))).rejects.toThrow();
  });

  it('dev: 404s when the file is missing on disk, instead of a raw 500', async () => {
    import.meta.env.PROD = false;
    const enoent = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    vi.mocked(readFile).mockRejectedValueOnce(enoent);
    const res = await GET(makeCtx());
    expect(res.status).toBe(404);
  });
});
