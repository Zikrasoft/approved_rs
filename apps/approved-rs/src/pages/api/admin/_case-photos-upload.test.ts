import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';

vi.mock('@/lib/githubContents', () => ({
  listGithubDir: vi.fn(),
  getGithubFile: vi.fn(),
  commitGalleryPhotos: vi.fn(),
  GithubApiError: class GithubApiError extends Error {
    status: number;
    constructor(status: number, path: string, body: string) {
      super(`GitHub API ${path} failed: ${status} ${body}`);
      this.status = status;
    }
  },
}));
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi
    .fn()
    .mockResolvedValue('title: BMW\nimage: ./image.jpg\ndate: 2026-01-01\n'),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import { POST } from './case-photos-upload';
import {
  listGithubDir,
  getGithubFile,
  commitGalleryPhotos,
  GithubApiError,
} from '@/lib/githubContents';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

function makeCtx(
  opts: {
    cookie?: string;
    dir?: string;
    slug?: string;
    photos?: string[];
  } = {},
): APIContext {
  const form = new FormData();
  form.set('dir', opts.dir ?? 'src/content/cases');
  form.set('slug', opts.slug ?? 'bmw-320');
  for (const name of opts.photos ?? ['photo.jpg']) {
    form.append('photos', new File(['x'], name, { type: 'image/jpeg' }));
  }
  const request = new Request('http://localhost/api/admin/case-photos-upload', {
    method: 'POST',
    body: form,
  });
  return {
    request,
    cookies: {
      get: (name: string) =>
        opts.cookie && name === 'keystatic-gh-access-token'
          ? { value: opts.cookie }
          : undefined,
    },
  } as unknown as APIContext;
}

describe('POST /api/admin/case-photos-upload', () => {
  const originalProd = import.meta.env.PROD;

  afterEach(() => {
    import.meta.env.PROD = originalProd;
    vi.clearAllMocks();
  });

  describe('dev (no cookie required)', () => {
    beforeEach(() => {
      import.meta.env.PROD = false;
    });

    it('rejects an unknown collection dir with 400', async () => {
      const res = await POST(makeCtx({ dir: 'src/content/nope' }));
      expect(res.status).toBe(400);
    });

    it('rejects a slug with unsafe characters with 400', async () => {
      const res = await POST(makeCtx({ slug: '../etc' }));
      expect(res.status).toBe(400);
    });

    it('redirects back with error=no-files when no photos are attached', async () => {
      const res = await POST(makeCtx({ photos: [] }));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('error=no-files');
    });

    it('404s when the case folder does not exist', async () => {
      vi.mocked(existsSync).mockReturnValueOnce(false);
      const res = await POST(makeCtx());
      expect(res.status).toBe(404);
    });

    it('writes the file to disk and redirects with ok=N on success', async () => {
      const res = await POST(makeCtx({ photos: ['a.jpg', 'b.jpg'] }));
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('ok=2');
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledTimes(3); // 2 photos + updated index.md
    });
  });

  describe('prod (cookie required)', () => {
    beforeEach(() => {
      import.meta.env.PROD = true;
      vi.mocked(listGithubDir).mockResolvedValue([]);
      vi.mocked(getGithubFile).mockResolvedValue(
        'title: BMW\nimage: ./image.jpg\ndate: 2026-01-01\n',
      );
      vi.mocked(commitGalleryPhotos).mockResolvedValue(undefined);
    });

    it('401s when no auth cookie is present', async () => {
      const res = await POST(makeCtx({ cookie: undefined }));
      expect(res.status).toBe(401);
      expect(commitGalleryPhotos).not.toHaveBeenCalled();
    });

    it('commits via the GitHub API and redirects with ok=N when the cookie is present', async () => {
      const res = await POST(
        makeCtx({ cookie: 'gh-token', photos: ['a.jpg'] }),
      );
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toContain('ok=1');
      expect(commitGalleryPhotos).toHaveBeenCalledWith(
        'gh-token',
        expect.objectContaining({
          indexPath: 'src/content/cases/bmw-320/index.md',
        }),
      );
    });

    it('reports 404 when the case file is missing on GitHub', async () => {
      vi.mocked(getGithubFile).mockRejectedValueOnce(
        new GithubApiError(404, 'x', 'not found'),
      );
      const res = await POST(makeCtx({ cookie: 'gh-token' }));
      expect(res.status).toBe(404);
    });

    it('propagates a non-404 GitHub failure instead of reporting "not found"', async () => {
      vi.mocked(getGithubFile).mockRejectedValueOnce(
        new GithubApiError(500, 'x', 'boom'),
      );
      await expect(POST(makeCtx({ cookie: 'gh-token' }))).rejects.toThrow();
    });
  });

  it('rejects a file over the size cap with 413, regardless of environment', async () => {
    import.meta.env.PROD = false;
    const form = new FormData();
    form.set('dir', 'src/content/cases');
    form.set('slug', 'bmw-320');
    form.append(
      'photos',
      new File([new Uint8Array(11 * 1024 * 1024)], 'huge.jpg', {
        type: 'image/jpeg',
      }),
    );
    const ctx = {
      request: new Request('http://localhost/api/admin/case-photos-upload', {
        method: 'POST',
        body: form,
      }),
      cookies: { get: () => undefined },
    } as unknown as APIContext;

    const res = await POST(ctx);
    expect(res.status).toBe(413);
  });
});
