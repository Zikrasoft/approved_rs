import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse } from 'yaml';

const files = execSync('git ls-files "apps/*/src/content/i18n/*.yaml"')
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

let failed = false;
for (const file of files) {
  try {
    parse(await readFile(file, 'utf-8'));
  } catch (err) {
    failed = true;
    console.error(`${file}: ${(err as Error).message}`);
  }
}

if (failed) {
  console.error(
    '\nInvalid YAML in i18n content — a string with a bare ": " needs quoting.',
  );
  process.exit(1);
}
