import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { listGithubDir, getGithubFile, commitGalleryPhotos } from './githubContents';

function okJson(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

describe('listGithubDir', () => {
  afterEach(() => mockFetch.mockReset());

  it('returns file names from the contents API', async () => {
    mockFetch.mockResolvedValue(okJson([{ name: '0.jpg' }, { name: '1.jpg' }]));
    expect(await listGithubDir('tok', 'src/content/cases/bmw/gallery')).toEqual(['0.jpg', '1.jpg']);
  });

  it('treats a 404 (no gallery folder yet) as empty, not an error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') });
    expect(await listGithubDir('tok', 'src/content/cases/bmw/gallery')).toEqual([]);
  });

  it('throws on other errors instead of silently returning empty', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') });
    await expect(listGithubDir('tok', 'x')).rejects.toThrow(/500/);
  });
});

describe('getGithubFile', () => {
  afterEach(() => mockFetch.mockReset());

  it('base64-decodes the contents API response to text', async () => {
    mockFetch.mockResolvedValue(okJson({ content: Buffer.from('title: BMW').toString('base64') }));
    expect(await getGithubFile('tok', 'src/content/cases/bmw/index.md')).toBe('title: BMW');
  });
});

describe('commitGalleryPhotos', () => {
  beforeEach(() => mockFetch.mockReset());

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
      indexContent: 'title: BMW\ngallery:\n  - gallery/0.jpg\n  - gallery/1.jpg\n',
      message: 'Add 2 gallery photo(s) to bmw',
    });

    expect(mockFetch).toHaveBeenCalledTimes(7);

    const treeCall = mockFetch.mock.calls[4];
    const treeBody = JSON.parse(treeCall[1].body);
    expect(treeBody.base_tree).toBe('base-tree-sha');
    expect(treeBody.tree).toEqual([
      { path: 'src/content/cases/bmw/gallery/0.jpg', mode: '100644', type: 'blob', sha: 'blob-sha-1' },
      { path: 'src/content/cases/bmw/gallery/1.jpg', mode: '100644', type: 'blob', sha: 'blob-sha-2' },
      { path: 'src/content/cases/bmw/index.md', mode: '100644', type: 'blob', content: 'title: BMW\ngallery:\n  - gallery/0.jpg\n  - gallery/1.jpg\n' },
    ]);

    const commitCall = mockFetch.mock.calls[5];
    const commitBody = JSON.parse(commitCall[1].body);
    expect(commitBody).toEqual({ message: 'Add 2 gallery photo(s) to bmw', tree: 'new-tree-sha', parents: ['base-commit-sha'] });

    const refCall = mockFetch.mock.calls[6];
    expect(refCall[0]).toContain('/git/refs/heads/main');
    expect(JSON.parse(refCall[1].body)).toEqual({ sha: 'new-commit-sha' });
  });

  it('propagates a failure from any step instead of updating the ref on a partial write', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: 'base-tree-sha' } }))
      .mockResolvedValueOnce({ ok: false, status: 422, text: () => Promise.resolve('bad blob') });

    await expect(commitGalleryPhotos('tok', {
      photos: [{ path: 'x/gallery/0.jpg', base64: 'aaaa' }],
      indexPath: 'x/index.md',
      indexContent: 'title: X',
      message: 'msg',
    })).rejects.toThrow(/422/);

    // Never reached the ref-update step — no dangling commit gets pointed at.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
