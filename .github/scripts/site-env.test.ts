import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  SITES,
  manifest,
  siteEnvFile,
  siteEnvManifest,
  siteEnvNames,
  siteValues,
} from './site-env.ts';

const ASTRO_BUILT_INS = new Set(['DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL']);
const SOURCE = /\.(ts|mts|mjs|js|astro)$/;
const NOT_RUNTIME = /\.(test|spec)\.|\/(testing|__tests__|generated)\//;

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return SOURCE.test(path) && !NOT_RUNTIME.test(path) ? [path] : [];
  });
}

function workspacePackages(dir: string, seen = new Set<string>()): Set<string> {
  const { dependencies = {} } = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8'),
  );
  for (const name of Object.keys(dependencies)) {
    if (!name.startsWith('@podbor/') || seen.has(name)) continue;
    seen.add(name);
    workspacePackages(`packages/${name.slice('@podbor/'.length)}`, seen);
  }
  return seen;
}

const READS = [
  /(?:process\.env|import\.meta\.env|\benv)\??\.([A-Z][A-Z0-9_]*)\b/g,
  /\benv\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /\b(?:requireEnv|required)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g,
];
const SECRET_PAIR = /acceptedSecrets\([^,()]+,\s*['"]([A-Z][A-Z0-9_]*)['"]/g;
const ZOD_OBJECT = /z\.object\(\{((?:[^{}]|\{[^{}]*\})*)\}/g;
const UPPER_KEY = /^\s*([A-Z][A-Z0-9_]*)\??\s*:/gm;

function envNamesIn(source: string): string[] {
  const names = READS.flatMap((read) =>
    [...source.matchAll(read)].map((match) => match[1]),
  );
  for (const [, name] of source.matchAll(SECRET_PAIR))
    names.push(name, `${name}_PREVIOUS`);
  for (const [, body] of source.matchAll(ZOD_OBJECT))
    for (const [, key] of body.matchAll(UPPER_KEY)) names.push(key);
  return names;
}

function envNamesReadBy(app: string): Set<string> {
  const dir = `apps/${app}`;
  const files = [
    ...filesUnder(`${dir}/src`),
    ...['astro.config.mjs', 'keystatic.config.ts']
      .map((file) => `${dir}/${file}`)
      .filter((file) => existsSync(file)),
    ...[...workspacePackages(dir)].flatMap((name) =>
      filesUnder(`packages/${name.slice('@podbor/'.length)}/src`),
    ),
  ];
  return new Set(
    files.flatMap((file) => envNamesIn(readFileSync(file, 'utf8'))),
  );
}

for (const app of SITES)
  test(`the manifest names every variable ${app} reads`, () => {
    const listed = new Set([
      ...Object.keys(manifest.sites[app]),
      ...Object.keys(manifest.shared),
      ...Object.keys(manifest.notInSiteEnv),
      ...ASTRO_BUILT_INS,
    ]);
    const missing = [...envNamesReadBy(app)].filter(
      (name) => !listed.has(name),
    );
    assert.deepEqual(missing, []);
  });

test('the scanner sees each way the apps read a variable', () => {
  const source = `
    process.env.A_ONE; import.meta.env.A_TWO; env?.A_THREE; env['A_FOUR'];
    requireEnv('A_FIVE'); acceptedSecrets(process.env, 'A_SIX');
    const schema = z.object({
      A_SEVEN: z.string(),
      lower: z.object({
        A_EIGHT: x,
      }),
    });
  `;
  assert.deepEqual(envNamesIn(source).sort(), [
    'A_EIGHT',
    'A_FIVE',
    'A_FOUR',
    'A_ONE',
    'A_SEVEN',
    'A_SIX',
    'A_SIX_PREVIOUS',
    'A_THREE',
    'A_TWO',
  ]);
});

test('a site gets the shared names and its own, each once', () => {
  const names = siteEnvNames('detailing').map(({ name }) => name);
  assert.ok(names.includes('TELEGRAM_BOT_TOKEN'));
  assert.ok(names.includes('TELEGRAM_CAPTURE_BOT_TOKEN'));
  assert.ok(!names.includes('CRON_SECRET'));
  assert.equal(new Set(names).size, names.length);
});

test('a name a site reads but leaves unset never reaches its env', () => {
  const names = siteEnvNames('detailing').map(({ name }) => name);
  assert.equal(manifest.sites.detailing.META_CAPI_TOKEN, 'unset');
  assert.ok(!names.includes('META_CAPI_TOKEN'));
});

test('a name is never both shared and per site', () => {
  for (const app of SITES)
    for (const name of Object.keys(manifest.sites[app]))
      assert.ok(!(name in manifest.shared), `${name} on ${app}`);
});

const detailingSecrets = {
  TELEGRAM_BOT_TOKEN: '1:crm',
  TELEGRAM_GROUP_ID: '-100',
  KEYSTATIC_GITHUB_CLIENT_ID: 'id',
  KEYSTATIC_GITHUB_CLIENT_SECRET: 'kgs',
  KEYSTATIC_SECRET: 'ks',
  TELEGRAM_CAPTURE_BOT_TOKEN: '2:capture',
  TELEGRAM_CAPTURE_WEBHOOK_SECRET: 'tcws',
  VPS_SSH_KEY: 'vps-key',
  github_token: 'ghs',
};
const detailingVars = {
  TELEGRAM_BOT_USERNAME: 'SerbCRMBot',
  PUBLIC_PHONE_NUMBER: '381 11',
  PUBLIC_WHATSAPP_NUMBER: '381 12',
  PUBLIC_VIBER_NUMBER: '381 13',
  PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: 'details-app',
  RUNNER: 'self-hosted',
};

test('the site env holds only manifest names, single-quoted, in manifest order', () => {
  const file = siteEnvFile('detailing', detailingSecrets, detailingVars);
  assert.equal(
    file,
    [
      "TELEGRAM_BOT_TOKEN='1:crm'",
      "TELEGRAM_BOT_USERNAME='SerbCRMBot'",
      "TELEGRAM_GROUP_ID='-100'",
      "PUBLIC_PHONE_NUMBER='381 11'",

      "PUBLIC_KEYSTATIC_GITHUB_APP_SLUG='details-app'",
      "KEYSTATIC_GITHUB_CLIENT_ID='id'",
      "KEYSTATIC_GITHUB_CLIENT_SECRET='kgs'",
      "KEYSTATIC_SECRET='ks'",
      "TELEGRAM_CAPTURE_BOT_TOKEN='2:capture'",
      "TELEGRAM_CAPTURE_WEBHOOK_SECRET='tcws'",
      "PUBLIC_WHATSAPP_NUMBER='381 12'",
      "PUBLIC_VIBER_NUMBER='381 13'",
      '',
    ].join('\n'),
  );
});

test('a missing or empty required name fails, naming every one and no value', () => {
  const { TELEGRAM_BOT_TOKEN, ...secrets } = detailingSecrets;
  assert.ok(TELEGRAM_BOT_TOKEN);
  assert.throws(
    () =>
      siteEnvFile('detailing', secrets, {
        ...detailingVars,
        PUBLIC_PHONE_NUMBER: '',
      }),
    {
      message:
        'detailing: required TELEGRAM_BOT_TOKEN (secret), PUBLIC_PHONE_NUMBER (variable) not set',
    },
  );
});

test('a secret set as a variable does not count', () => {
  const { TELEGRAM_GROUP_ID, ...secrets } = detailingSecrets;
  assert.throws(
    () =>
      siteEnvFile('detailing', secrets, {
        ...detailingVars,
        TELEGRAM_GROUP_ID,
      }),
    /required TELEGRAM_GROUP_ID \(secret\) not set/,
  );
});

test('a value a .env cannot hold literally is refused by name', () => {
  assert.throws(
    () =>
      siteEnvFile(
        'detailing',
        { ...detailingSecrets, KEYSTATIC_SECRET: "it's\nsecret" },
        detailingVars,
      ),
    (error: Error) =>
      error.message ===
        'detailing: KEYSTATIC_SECRET holds a quote or a line break' &&
      !error.message.includes('secret\n'),
  );
});

test('an unknown site is refused', () => {
  assert.throws(() => siteEnvNames('shop'), /unknown site shop/);
});

test('a manifest entry outside the vocabulary is refused', () => {
  const result = siteEnvManifest.safeParse({
    ...manifest,
    shared: {
      ...manifest.shared,
      NEW_NAME: { required: true, kind: 'secrte' },
    },
  });
  assert.equal(result.success, false);
});

test('a manifest entry still in the old one-string shape is refused', () => {
  const result = siteEnvManifest.safeParse({
    ...manifest,
    shared: { ...manifest.shared, NEW_NAME: 'required secret' },
  });
  assert.equal(result.success, false);
});

test('a manifest entry says whether a name is required and where it is kept', () => {
  assert.deepEqual(manifest.shared.TELEGRAM_BOT_TOKEN, {
    required: true,
    kind: 'secret',
  });
  assert.deepEqual(
    siteEnvNames('detailing').find(({ name }) => name === 'TELEGRAM_OWNER_ID'),
    {
      name: 'TELEGRAM_OWNER_ID',
      required: false,
      kind: 'secret',
      shared: true,
    },
  );
});

test('an unset values variable reads as no values', () => {
  assert.deepEqual(siteValues('SITE_VARS', undefined), {});
  assert.deepEqual(siteValues('SITE_VARS', ''), {});
});

test('the values come from a JSON object of strings', () => {
  assert.deepEqual(siteValues('SITE_VARS', '{"A":"1","B":""}'), {
    A: '1',
    B: '',
  });
});

for (const [what, text] of [
  ['not JSON', "{'A':'secret-value'}"],
  ['an array', '["secret-value"]'],
  ['a non-string value', '{"A":{"nested":"secret-value"}}'],
  ['null', 'null'],
])
  test(`values that are ${what} are refused by variable name alone`, () => {
    assert.throws(
      () => siteValues('SITE_SECRETS', text),
      (error: Error) =>
        error.message === 'SITE_SECRETS is not a JSON object of strings' &&
        !error.message.includes('secret-value'),
    );
  });
