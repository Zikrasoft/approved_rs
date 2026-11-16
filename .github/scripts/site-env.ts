import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

const entry = z.enum([
  'required secret',
  'optional secret',
  'required variable',
  'optional variable',
  'unset',
]);
const names = z.record(z.string().regex(ENV_NAME), entry);

export const siteEnvManifest = z.strictObject({
  notInSiteEnv: z.record(z.string().regex(ENV_NAME), z.string()),
  shared: names,
  sites: z.record(z.string(), names),
});

export const manifest = siteEnvManifest.parse(
  JSON.parse(readFileSync(new URL('./site-env.json', import.meta.url), 'utf8')),
);

export const SITES = Object.keys(manifest.sites);

export type SiteEnvName = {
  name: string;
  required: boolean;
  kind: 'secret' | 'variable';
  shared: boolean;
};

const entries = (list: z.infer<typeof names>, shared: boolean) =>
  Object.entries(list).flatMap(([name, need]): SiteEnvName[] =>
    need === 'unset'
      ? []
      : [
          {
            name,
            required: need.startsWith('required'),
            kind: need.endsWith('secret') ? 'secret' : 'variable',
            shared,
          },
        ],
  );

export function siteEnvNames(app: string): SiteEnvName[] {
  const own = manifest.sites[app];
  if (!own) throw new Error(`unknown site ${app}`);
  return [...entries(manifest.shared, true), ...entries(own, false)];
}

type Values = Record<string, string>;

const jsonValues = z
  .string()
  .transform((text, context): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      context.addIssue({ code: 'custom', message: 'not JSON' });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string(), z.string()));

export function siteValues(name: string, text: string | undefined): Values {
  const parsed = jsonValues.safeParse(text || '{}');
  if (!parsed.success)
    throw new Error(`${name} is not a JSON object of strings`);
  return parsed.data;
}

export function siteEnvFile(app: string, secrets: Values, vars: Values) {
  const lines: string[] = [];
  const missing: string[] = [];
  for (const { name, required, kind } of siteEnvNames(app)) {
    const value = (kind === 'secret' ? secrets : vars)[name];
    if (!value) {
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

if (import.meta.main) {
  const [app, out] = process.argv.slice(2);
  try {
    const file = siteEnvFile(
      app ?? '',
      siteValues('SITE_SECRETS', process.env.SITE_SECRETS),
      siteValues('SITE_VARS', process.env.SITE_VARS),
    );
    writeFileSync(out ?? '', file, { mode: 0o600 });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
