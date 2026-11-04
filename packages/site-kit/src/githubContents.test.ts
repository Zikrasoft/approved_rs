import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGithubContents, GithubApiError } from './githubContents.ts';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const github = createGithubContents({
  repo: 'Zikrasoft/approved_rs',
  branch: 'main',
  appRoot: 'apps/approved-rs/',
  userAgent: 'approved-rs-admin',
});

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const failing = (status: number, body = '') => ({
  ok: false,
  status,
  text: () => Promise.resolve(body),
});

afterEach(() => mockFetch.mockReset());

describe('listDir', () => {
  it('returns file names from the contents API under the app root', async () => {
    mockFetch.mockResolvedValue(okJson([{ name: '0.jpg' }, { name: '1.jpg' }]));

    expect(
      await github.listDir('tok', 'src/content/cases/bmw/gallery'),
    ).toEqual(['0.jpg', '1.jpg']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/Zikrasoft/approved_rs/contents/apps/approved-rs/src/content/cases/bmw/gallery?ref=main',
    );
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'User-Agent': 'approved-rs-admin',
    });
  });

  it('treats a 404 (no folder yet) as empty, not an error', async () => {
    mockFetch.mockResolvedValue(failing(404));

    expect(await github.listDir('tok', 'x')).toEqual([]);
  });

  it('throws on other errors instead of silently returning empty', async () => {
    mockFetch.mockResolvedValue(failing(500, 'boom'));

    await expect(github.listDir('tok', 'x')).rejects.toThrow(/500/);
  });

  it('refuses a contents response that is not a directory listing', async () => {
    mockFetch.mockResolvedValue(okJson({ name: 'index.md', content: '' }));

    await expect(github.listDir('tok', 'x')).rejects.toThrow();
  });
});

describe('getFile', () => {
  it('base64-decodes the contents API response to text', async () => {
    mockFetch.mockResolvedValue(
      okJson({ content: Buffer.from('title: BMW').toString('base64') }),
    );

    expect(await github.getFile('tok', 'x/index.md')).toBe('title: BMW');
  });

  it('throws a GithubApiError carrying the HTTP status', async () => {
    mockFetch.mockResolvedValue(failing(404, 'not found'));

    const error = await github.getFile('tok', 'x/index.md').catch((e) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe('getFileBuffer', () => {
  it('returns raw bytes without a lossy utf-8 round-trip', async () => {
    const raw = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    mockFetch.mockResolvedValue(okJson({ content: raw.toString('base64') }));

    expect(await github.getFileBuffer('tok', 'x/gallery/0.jpg')).toEqual(raw);
  });
});

describe('commitFiles', () => {
  it('writes binary files as blobs and text inline, in a single commit on the branch', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: 'base-tree-sha' } }))
      .mockResolvedValueOnce(okJson({ sha: 'blob-sha-1' }))
      .mockResolvedValueOnce(okJson({ sha: 'new-tree-sha' }))
      .mockResolvedValueOnce(okJson({ sha: 'new-commit-sha' }))
      .mockResolvedValueOnce(okJson({}));

    await github.commitFiles('tok', {
      files: [
        { path: 'src/content/cases/bmw/gallery/0.jpg', base64: 'aaaa' },
        { path: 'src/content/cases/bmw/index.md', content: 'title: BMW\n' },
      ],
      message: 'Add a photo to bmw',
    });

    expect(mockFetch).toHaveBeenCalledTimes(6);
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toEqual({
      content: 'aaaa',
      encoding: 'base64',
    });
    expect(JSON.parse(mockFetch.mock.calls[3][1].body)).toEqual({
      base_tree: 'base-tree-sha',
      tree: [
        {
          path: 'apps/approved-rs/src/content/cases/bmw/gallery/0.jpg',
          mode: '100644',
          type: 'blob',
          sha: 'blob-sha-1',
        },
        {
          path: 'apps/approved-rs/src/content/cases/bmw/index.md',
          mode: '100644',
          type: 'blob',
          content: 'title: BMW\n',
        },
      ],
    });
    expect(JSON.parse(mockFetch.mock.calls[4][1].body)).toEqual({
      message: 'Add a photo to bmw',
      tree: 'new-tree-sha',
      parents: ['base-commit-sha'],
    });
    const [refUrl, refInit] = mockFetch.mock.calls[5];
    expect(refUrl).toContain('/git/refs/heads/main');
    expect(JSON.parse(refInit.body)).toEqual({ sha: 'new-commit-sha' });
  });

  it('propagates a failure from any step instead of moving the branch onto a partial write', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: { sha: 'base-tree-sha' } }))
      .mockResolvedValueOnce(failing(422, 'bad blob'));

    await expect(
      github.commitFiles('tok', {
        files: [{ path: 'x/gallery/0.jpg', base64: 'aaaa' }],
        message: 'msg',
      }),
    ).rejects.toThrow(/422/);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('refuses a response without a sha instead of committing onto undefined', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson({ object: { sha: 'base-commit-sha' } }))
      .mockResolvedValueOnce(okJson({ tree: {} }));

    await expect(
      github.commitFiles('tok', {
        files: [{ path: 'x/index.md', content: 'title: X' }],
        message: 'msg',
      }),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('canWrite', () => {
  it('accepts a token GitHub lets push to the repo', async () => {
    mockFetch.mockResolvedValue(okJson({ permissions: { push: true } }));

    expect(await github.canWrite('tok')).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/Zikrasoft/approved_rs',
    );
  });

  it('refuses a token that can only read the repo', async () => {
    mockFetch.mockResolvedValue(okJson({ permissions: { push: false } }));

    expect(await github.canWrite('tok')).toBe(false);
  });

  it.each([401, 403, 404])(
    'refuses a token GitHub answers %i for',
    async (status) => {
      mockFetch.mockResolvedValue(failing(status));

      expect(await github.canWrite('forged')).toBe(false);
    },
  );

  it('throws when GitHub itself fails', async () => {
    mockFetch.mockResolvedValue(failing(502));

    await expect(github.canWrite('tok')).rejects.toThrow(/502/);
  });
});
