import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { SITES, siteEnvNames, type SiteEnvName } from './site-env.ts';

// TODO: delete this script and its test once the Vercel fallback week is over.

const dryRun = process.argv.includes('--dry-run');
const team = process.env.VERCEL_TEAM || 'aleksey-zikrackiys-projects';
const FROM_VERCEL_ITSELF = /^(VERCEL($|_)|BLOB_READ_WRITE_TOKEN$)/;

function run(command: string, args: string[], input?: string) {
  const result = spawnSync(command, args, {
    input,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  return result.status === 0;
}

function must(command: string, args: string[], what: string, input?: string) {
  if (run(command, args, input)) return;
  console.error(`${command} failed: ${what}`);
  process.exit(1);
}

for (const [tool, args] of [
  ['vercel', ['whoami']],
  ['gh', ['auth', 'status']],
] as const)
  if (!run(tool, [...args])) {
    console.error(`log in to ${tool} first`);
    process.exit(1);
  }

const work = mkdtempSync(join(tmpdir(), 'env-to-github-'));
process.on('exit', () => rmSync(work, { recursive: true, force: true }));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => process.exit(130));

const pulled = new Map<string, Record<string, string>>();
for (const app of SITES) {
  const dir = join(work, app);
  mkdirSync(dir);
  const file = join(work, `${app}.env`);
  must(
    'vercel',
    ['link', '--yes', '--project', app, '--scope', team, '--cwd', dir],
    `link ${app}`,
  );
  must(
    'vercel',
    ['env', 'pull', file, '--yes', '--environment=production', '--cwd', dir],
    `env pull ${app}`,
  );
  pulled.set(
    app,
    z
      .record(z.string(), z.string())
      .parse(parseEnv(readFileSync(file, 'utf8'))),
  );
}

type Move = SiteEnvName & { value: string; environment?: string };
const moves: Move[] = [];
const report: string[] = [];
const divergent: string[] = [];

const shared = siteEnvNames(SITES[0]).filter((entry) => entry.shared);
for (const entry of shared) {
  const byValue = new Map<string, string[]>();
  for (const app of SITES) {
    const value = pulled.get(app)?.[entry.name];
    if (value) byValue.set(value, [...(byValue.get(value) ?? []), app]);
  }
  if (byValue.size > 1)
    divergent.push(
      `${entry.name} differs: ${[...byValue.values()].map((apps) => apps.join(', ')).join(' | ')}`,
    );
  const [value] = byValue.keys();
  if (value) moves.push({ ...entry, value });
  else if (entry.required) report.push(`missing: ${entry.name} (shared)`);
}

if (divergent.length) {
  console.error(divergent.join('\n'));
  console.error(
    'Make the projects agree in Vercel, or set the variable in GitHub by hand and drop it from the projects that differ, then run again. Nothing was written.',
  );
  process.exit(1);
}

for (const app of SITES) {
  const env = pulled.get(app) ?? {};
  const names = siteEnvNames(app);
  for (const entry of names.filter((name) => !name.shared)) {
    const value = env[entry.name];
    if (value) moves.push({ ...entry, value, environment: `site-${app}` });
    else if (entry.required) report.push(`missing: ${entry.name} (${app})`);
  }
  const known = new Set(names.map(({ name }) => name));
  for (const name of Object.keys(env))
    if (!known.has(name) && !FROM_VERCEL_ITSELF.test(name))
      report.push(`not migrated: ${name} (${app})`);
}

for (const app of SITES) {
  const environment = `site-${app}`;
  const path = `repos/{owner}/{repo}/environments/${environment}`;
  if (run('gh', ['api', path])) continue;
  if (dryRun) console.log(`would create environment ${environment}`);
  else must('gh', ['api', '-X', 'PUT', path], `create ${environment}`);
}

for (const { name, kind, value, environment } of moves) {
  console.log(`${name} -> ${environment ?? 'repository'} ${kind}`);
  if (dryRun) continue;
  must(
    'gh',
    [kind, 'set', name, ...(environment ? [`--env=${environment}`] : [])],
    `set ${name}`,
    value,
  );
}

if (report.length) console.log(report.join('\n'));
