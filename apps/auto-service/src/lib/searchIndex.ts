import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pagefind from 'pagefind';

export async function buildSearchIndex(
  site: string,
  outputs: string[],
): Promise<{ languages: Record<string, number> }> {
  const { index, errors } = await pagefind.createIndex();
  try {
    if (!index) throw new Error(errors.join('\n'));
    const added = await index.addDirectory({ path: site });
    if (added.errors.length) throw new Error(added.errors.join('\n'));
    for (const outputPath of outputs) {
      const written = await index.writeFiles({ outputPath });
      if (written.errors.length) throw new Error(written.errors.join('\n'));
    }
    const entry = JSON.parse(
      readFileSync(join(outputs[0], 'pagefind-entry.json'), 'utf8'),
    ) as { languages: Record<string, { page_count: number }> };
    return {
      languages: Object.fromEntries(
        Object.entries(entry.languages).map(([lang, info]) => [
          lang,
          info.page_count,
        ]),
      ),
    };
  } finally {
    await pagefind.close();
  }
}
