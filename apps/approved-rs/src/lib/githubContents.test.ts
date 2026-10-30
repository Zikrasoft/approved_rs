import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('node:fs', () => ({ existsSync: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readdir: vi.fn() }));

import {
  listGithubDir,
  listGalleryFiles,
  commitGalleryPhotos,
} from './githubContents';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

function okJson(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

describe('listGalleryFiles', () => {
  const originalProd = import.meta.env.PROD;

  afterEach(() => {
    import.meta.env.PROD = originalProd;
    mockFetch.mockReset();
    vi.mocked(existsSync).mockReset();
    vi.mocked(readdir).mockReset();
  });

  it('prod: delegates to listGithubDir', async () => {
    import.meta.env.PROD = true;
    mockFetch.mockResolvedValue(okJson([{ name: '0.jpg' }]));
    expect(await listGalleryFiles('tok', 'x/gallery')).toEqual(['0.jpg']);
  });

  it('prod: a non-404 GitHub failure degrades to empty instead of throwing', async () => {
    import.meta.env.PROD = true;
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('bad token'),
    });
    await expect(listGalleryFiles('stale-tok', 'x/gallery')).resolves.toEqual(
      [],
    );
  });

  it('dev: reads the directory off disk when it exists', async () => {
    import.meta.env.PROD = false;
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['0.jpg'] as never);
    expect(
      await listGalleryFiles(undefined, 'src/content/cases/bmw/gallery'),
    ).toEqual(['0.jpg']);
  });

  it('dev: returns empty when the gallery dir does not exist yet', async () => {
    import.meta.env.PROD = false;
    vi.mocked(existsSync).mockReturnValue(false);
    expect(
      await listGalleryFiles(undefined, 'src/content/cases/bmw/gallery'),
    ).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });
});

describe('commitGalleryPhotos', () => {
  beforeEach(() => mockFetch.mockReset());

  it('prefixes every content path with the app root — the repo holds several apps', async () => {
    mockFetch.mockResolvedValueOnce(okJson([{ name: '0.jpg' }]));
    await listGithubDir('tok', 'src/content/cases/bmw/gallery');
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      '/contents/apps/approved-rs/src/content/cases/bmw/gallery',
    );
  });

  it('does exactly one blob call per photo, then one tree/commit/ref-update call each — a single atomic commit', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } })) // get ref
      .mockResolvedValueOnce(okJson({ tree: { sha: 'base-tree-sha' } })) // get commit
      .mockResolvedValueOnce(okJson({ sha: 'blob-sha-1' })) // blob for photo 1
      .mockResolvedValueOnce(okJson({ sha: 'blob-sha-2' })) // blob for photo 2
      .mockResolvedValueOnce(okJson({ sha: 'new-tree-sha' })) // create tree
      .mockResolvedValueOnce(okJson({ sha: 'new-commit-sha' })) // create commit
      .mockResolvedValueOnce(okJson({})); // update ref

    await commitGalleryPhotos('tok', {
      photos: [
        { path: 'src/content/cases/bmw/gallery/0.jpg', base64: 'aaaa' },
        { path: 'src/content/cases/bmw/gallery/1.jpg', base64: 'bbbb' },
      ],
      indexPath: 'src/content/cases/bmw/index.md',
      indexContent:
        'title: BMW\ngallery:\n  - gallery/0.jpg\n  - gallery/1.jpg\n',
      message: 'Add 2 gallery photo(s) to bmw',
    });

    expect(mockFetch).toHaveBeenCalledTimes(7);

    const treeCall = mockFetch.mock.calls[4];
    const treeBody = JSON.parse(treeCall[1].body);
    expect(treeBody.base_tree).toBe('base-tree-sha');
    expect(treeBody.tree).toEqual([
      {
        path: 'apps/approved-rs/src/content/cases/bmw/gallery/0.jpg',
        mode: '100644',
        type: 'blob',
        sha: 'blob-sha-1',
      },
      {
        path: 'apps/approved-rs/src/content/cases/bmw/gallery/1.jpg',
        mode: '100644',
        type: 'blob',
        sha: 'blob-sha-2',
      },
      {
        path: 'apps/approved-rs/src/content/cases/bmw/index.md',
        mode: '100644',
        type: 'blob',
        content: 'title: BMW\ngallery:\n  - gallery/0.jpg\n  - gallery/1.jpg\n',
      },
    ]);

    const commitCall = mockFetch.mock.calls[5];
    const commitBody = JSON.parse(commitCall[1].body);
    expect(commitBody).toEqual({
      message: 'Add 2 gallery photo(s) to bmw',
      tree: 'new-tree-sha',
      parents: ['base-commit-sha'],
    });

    const refCall = mockFetch.mock.calls[6];
    expect(refCall[0]).toContain('/git/refs/heads/main');
    expect(JSON.parse(refCall[1].body)).toEqual({ sha: 'new-commit-sha' });
  });

  it('propagates a failure from any step instead of updating the ref on a partial write', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: 'base-tree-sha' } }))
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('bad blob'),
      });

    await expect(
      commitGalleryPhotos('tok', {
        photos: [{ path: 'x/gallery/0.jpg', base64: 'aaaa' }],
        indexPath: 'x/index.md',
        indexContent: 'title: X',
        message: 'msg',
      }),
    ).rejects.toThrow(/422/);

    // Never reached the ref-update step — no dangling commit gets pointed at.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('refuses a response without a sha instead of committing onto undefined', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: {} }));

    await expect(
      commitGalleryPhotos('tok', {
        photos: [{ path: 'x/gallery/0.jpg', base64: 'aaaa' }],
        indexPath: 'x/index.md',
        indexContent: 'title: X',
        message: 'msg',
      }),
    ).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
