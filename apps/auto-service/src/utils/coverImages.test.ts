import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import cover from '@/assets/mechanic-engine-teardown-wide.jpg';
import tall from '@/assets/mechanic-engine-teardown-tall.jpg';
import { work } from '@/components/workFixture';
import { GET as coverImagesRoute } from '../pages/cover-images.json.ts';
import { builtCover, COVER_IMAGES_FILE, readCoverImages } from './coverImages';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(async () => [
    work(),
    work({ id: 'draft', published: false, image: tall }),
  ]),
}));

const built = {
  src: '/_astro/cover_360.webp',
  srcset: '/_astro/cover_360.webp 360w, /_astro/cover_1080.webp 1080w',
  width: 1080,
  height: 720,
};

describe('readCoverImages', () => {
  let release: string | undefined;
  afterEach(async () => {
    if (release) await rm(release, { recursive: true, force: true });
  });

  it('finds the list the build wrote beside the server it runs in', async () => {
    release = await mkdtemp(join(tmpdir(), 'release-'));
    await mkdir(join(release, 'client'));
    await mkdir(join(release, 'server', 'chunks'), { recursive: true });
    await writeFile(
      join(release, 'client', COVER_IMAGES_FILE),
      JSON.stringify({ [cover.src]: built }),
    );

    expect(
      await readCoverImages(
        pathToFileURL(join(release, 'server', 'chunks', 'page.mjs')),
      ),
    ).toEqual({ [cover.src]: built });
  });

  it('answers null outside a build', async () => {
    release = await mkdtemp(join(tmpdir(), 'source-'));

    expect(
      await readCoverImages(pathToFileURL(join(release, 'page.mjs'))),
    ).toBeNull();
  });
});

describe('builtCover', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('takes the cover the build optimized', async () => {
    expect(
      await builtCover(cover, Promise.resolve({ [cover.src]: built })),
    ).toEqual(built);
  });

  it('optimizes on the fly in dev, where there is no build', async () => {
    const { src, srcset } = await builtCover(cover, Promise.resolve(null));

    expect(src).toContain('/_image');
    expect(srcset.split(', ')).toHaveLength(4);
  });

  it('fails loudly in production instead of printing a cover nothing serves', async () => {
    vi.stubEnv('DEV', false);

    await expect(builtCover(cover, Promise.resolve({}))).rejects.toThrow(
      cover.src,
    );
  });
});

describe('the cover images list', () => {
  it('optimizes the cover of every published Work, keyed by its file', async () => {
    const response = await coverImagesRoute(
      {} as Parameters<typeof coverImagesRoute>[0],
    );
    const list = await response.json();

    expect(Object.keys(list)).toEqual([cover.src]);
    expect(list[cover.src].srcset.split(', ')).toHaveLength(4);
    expect(list[cover.src].width).toBeGreaterThan(0);
  });
});
