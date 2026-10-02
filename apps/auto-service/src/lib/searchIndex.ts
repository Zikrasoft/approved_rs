import { z } from 'zod';
import * as pagefind from 'pagefind';

const entrySchema = z.object({
  languages: z.record(z.string(), z.object({ page_count: z.number() })),
});

export async function buildSearchIndex(
  site: string,
  outputs: string[],
): Promise<{ languages: Record<string, number> }> {
  const { index, errors } = await pagefind.createIndex();
  try {
    if (!index) throw new Error(errors.join('\n'));
    const added = await index.addDirectory({
      path: site,
      glob: '*/shop/*/*/index.html',
    });
    if (added.errors.length) throw new Error(added.errors.join('\n'));
    for (const outputPath of outputs) {
      const written = await index.writeFiles({ outputPath });
      if (written.errors.length) throw new Error(written.errors.join('\n'));
    }
    const built = await index.getFiles();
    if (built.errors.length) throw new Error(built.errors.join('\n'));
    const entryFile = built.files.find(
      (file) => file.path === 'pagefind-entry.json',
    );
    if (!entryFile) throw new Error('[search] pagefind wrote no entry file');
    const entry = entrySchema.parse(
      JSON.parse(new TextDecoder().decode(entryFile.content)),
    );
    const languages = Object.fromEntries(
      Object.entries(entry.languages).map(([lang, info]) => [
        lang,
        info.page_count,
      ]),
    );
    const total = Object.values(languages).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (total === 0) {
      throw new Error(
        '[search] indexed 0 pages — check the data-pagefind-body markers',
      );
    }
    return { languages };
  } finally {
    await pagefind.close();
  }
}
