import { glob, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { articleSchema, type ArticleEntry } from '@podbor/blog/article';
import { MAKE_SLUGS } from './makes.ts';

const schema = articleSchema({ image: z.string(), makes: MAKE_SLUGS });
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export async function articleFiles(dir: string): Promise<ArticleEntry[]> {
  const articles: ArticleEntry[] = [];
  for await (const file of glob('*/index.md', { cwd: dir })) {
    const source = await readFile(join(dir, file), 'utf8');
    articles.push({
      id: dirname(file),
      data: schema.parse(parse(FRONTMATTER.exec(source)?.[1] ?? '')),
    });
  }
  return articles;
}
