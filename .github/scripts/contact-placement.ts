import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Parser } from 'htmlparser2';

const CHANNEL = 'data-contact-channel';
const PLACEMENT = 'data-contact-placement';

async function* htmlFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

function orphans(html: string): string[] {
  const found: string[] = [];
  let depth = 0;
  let placementDepth: number | undefined;
  const parser = new Parser({
    onopentagname: () => depth++,
    onopentag: (name, attribs) => {
      if (PLACEMENT in attribs && placementDepth === undefined)
        placementDepth = depth;
      if (CHANNEL in attribs && placementDepth === undefined)
        found.push(`<${name} ${CHANNEL}="${attribs[CHANNEL]}">`);
    },
    onclosetag: () => {
      if (placementDepth === depth) placementDepth = undefined;
      depth--;
    },
  });
  parser.write(html);
  parser.end();
  return found;
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error(
    'usage: contact-placement.ts <built-site-dir> [<built-site-dir>...]',
  );
  process.exit(2);
}

let checked = 0;
const failures: string[] = [];

for (const root of roots) {
  for await (const file of htmlFiles(root)) {
    checked++;
    for (const orphan of orphans(await readFile(file, 'utf8')))
      failures.push(`${relative(process.cwd(), file)}: ${orphan}`);
  }
}

if (checked === 0) {
  console.error(`No HTML found under ${roots.join(', ')} — build first`);
  process.exit(2);
}

if (failures.length > 0) {
  console.error(
    `A contact control outside any [${PLACEMENT}] reports no placement on its contact_click:`,
  );
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(
  `${checked} pages: every [${CHANNEL}] sits inside a [${PLACEMENT}]`,
);
