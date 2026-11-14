import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { blogListed } from '@podbor/blog/article';
import { articleFiles } from './articleFiles';

let dir: string;

const write = async (id: string, frontmatter: string) => {
  await mkdir(join(dir, id), { recursive: true });
  await writeFile(
    join(dir, id, 'index.md'),
    `---\ntitle: ${id}\nlead: Лид\nimage: image.jpg\ndate: 2026-11-14\n${frontmatter}---\nТекст\n`,
  );
};

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('articleFiles', () => {
  it('reads the Articles on disk as the blog sees them', async () => {
    dir = await mkdtemp(join(tmpdir(), 'articles-'));
    await write('bmw', 'make: bmw\noverview: true\n');
    await write('draft', 'published: false\n');

    const articles = await articleFiles(dir);

    expect(articles.map(({ id }) => id).sort()).toEqual(['bmw', 'draft']);
    expect(blogListed(articles)).toBe(false);

    await write('oil', '');

    expect(blogListed(await articleFiles(dir))).toBe(true);
  });

  it('skips a folder without an Article in it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'articles-'));
    await mkdir(join(dir, 'empty'));
    await writeFile(join(dir, '.gitkeep'), '');

    expect(await articleFiles(dir)).toEqual([]);
  });

  it('refuses an Article whose frontmatter breaks the schema', async () => {
    dir = await mkdtemp(join(tmpdir(), 'articles-'));
    await write('tesla', 'make: tesla\n');

    await expect(articleFiles(dir)).rejects.toThrow();
  });
});
