import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse } from 'yaml';

const TELL = /[—Ёё]/;

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(strings);
  return [];
}

function russianSource(file: string, text: string): string[] {
  if (!file.endsWith('.md')) {
    const source = { ...parse(text) };
    delete source.translations;
    delete source.translatedFrom;
    return strings(source);
  }
  const [, frontmatter, ...body] = text.split(/^---$/m);
  const { title } = parse(frontmatter) ?? {};
  return [...strings(title), ...body.join('---').split(/\n\s*\n/)].map((s) =>
    s.trim(),
  );
}

export function copyTells(file: string, text: string): string[] {
  return russianSource(file, text).filter((s) => TELL.test(s));
}

if (import.meta.main) {
  const files = execSync(
    'git ls-files "apps/*/src/content/i18n/*.yaml" "apps/*/src/content/cases/*/index.md" "apps/*/src/content/works/*/index.md"',
  )
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);

  let failed = false;
  for (const file of files) {
    for (const tell of copyTells(file, await readFile(file, 'utf-8'))) {
      failed = true;
      console.error(`${file}: ${tell}`);
    }
  }

  if (failed) {
    console.error(
      '\nRussian source copy carries an em dash or Ё: use a comma, colon, period or hyphen, and е.',
    );
    process.exit(1);
  }
}
