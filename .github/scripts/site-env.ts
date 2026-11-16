import { readFileSync, writeFileSync } from 'node:fs';

type Kind = 'secret' | 'variable';
type Entry = `${'required' | 'optional'} ${Kind}` | 'unset';
export type SiteEnvName = {
  name: string;
  required: boolean;
  kind: Kind;
  shared: boolean;
};

const manifest: {
  shared: Record<string, Entry>;
  sites: Record<string, Record<string, Entry>>;
} = JSON.parse(
  readFileSync(new URL('./site-env.json', import.meta.url), 'utf8'),
);

export const SITES = Object.keys(manifest.sites);

const ENTRY = /^(required|optional) (secret|variable)$/;

const entries = (names: Record<string, Entry>, shared: boolean) =>
  Object.entries(names).flatMap(([name, entry]): SiteEnvName[] => {
    if (entry === 'unset') return [];
    const [, need, kind] = ENTRY.exec(entry) ?? [];
    if (!need) throw new Error(`site-env.json: ${name} is "${entry}"`);
    return [
      { name, required: need === 'required', kind: kind as Kind, shared },
    ];
  });

export function siteEnvNames(app: string): SiteEnvName[] {
  const own = manifest.sites[app];
  if (!own) throw new Error(`unknown site ${app}`);
  return [...entries(manifest.shared, true), ...entries(own, false)];
}

type Values = Record<string, unknown>;

export function siteEnvFile(app: string, secrets: Values, vars: Values) {
  const lines: string[] = [];
  const missing: string[] = [];
  for (const { name, required, kind } of siteEnvNames(app)) {
    const value = (kind === 'secret' ? secrets : vars)[name];
    if (typeof value !== 'string' || value === '') {
      if (required) missing.push(`${name} (${kind})`);
      continue;
    }
    if (/['\r\n]/.test(value))
      throw new Error(`${app}: ${name} holds a quote or a line break`);
    lines.push(`${name}='${value}'`);
  }
  if (missing.length)
    throw new Error(`${app}: required ${missing.join(', ')} not set`);
  return lines.map((line) => `${line}\n`).join('');
}

const readJson = (name: string): Values => {
  let value: unknown;
  try {
    value = JSON.parse(process.env[name] || '{}');
  } catch {
    value = null;
  }
  if (!value || typeof value !== 'object')
    throw new Error(`${name} is not a JSON object`);
  return value as Values;
};

if (import.meta.main) {
  const [app, out] = process.argv.slice(2);
  try {
    const file = siteEnvFile(
      app ?? '',
      readJson('SITE_SECRETS'),
      readJson('SITE_VARS'),
    );
    writeFileSync(out ?? '', file, { mode: 0o600 });
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
