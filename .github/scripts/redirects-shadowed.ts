import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { shadowedRedirects } from '../../packages/site-kit/src/redirects.ts';
import { REDIRECTS } from '../../apps/approved-rs/src/redirects.ts';

const client = process.argv[2];
if (!client) {
  console.error('usage: redirects-shadowed.ts <apps/approved-rs/dist/client>');
  process.exit(2);
}

const files = (await readdir(client, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map(
    (entry) =>
      `/${relative(client, join(entry.parentPath, entry.name)).split(sep).join('/')}`,
  );

const shadowed = shadowedRedirects(REDIRECTS, files);
if (shadowed.length > 0) {
  console.error(
    `Caddy serves these paths from ${client} before node sees them, so their redirect rule never fires: drop the file or the rule.\n${shadowed.join('\n')}`,
  );
  process.exit(1);
}
console.log(`${files.length} files, no redirect rule shadowed`);
