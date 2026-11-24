import { glob, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { MAKE_SLUGS } from './makes.ts';

const schema = z.object({
  make: z.enum(MAKE_SLUGS as [string, ...string[]]).optional(),
  image: z.string().optional(),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  date: z.coerce.date(),
});
const FRONTMATTER = /^---\n([\s\S]*?)\n---/;

export async function workFiles(dir: string) {
  const works = [];
  for await (const file of glob('*/index.md', { cwd: dir })) {
    const source = await readFile(join(dir, file), 'utf8');
    works.push({
      id: dirname(file),
      data: schema.parse(parse(FRONTMATTER.exec(source)?.[1] ?? '')),
    });
  }
  return works;
}
