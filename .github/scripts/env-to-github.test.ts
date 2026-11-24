import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./env-to-github.ts', import.meta.url).pathname;

const VERCEL = `#!/bin/sh
echo "vercel $*" >>"$LOG"
[ "$1" = whoami ] && exit "\${VERCEL_WHOAMI:-0}"
cwd= project= file= prev=
for arg in "$@"; do
  case "$prev" in
    --cwd) cwd=$arg ;;
    --project) project=$arg ;;
    pull) file=$arg ;;
  esac
  prev=$arg
done
case "$1" in
  link) echo "$project" >"$cwd/.project"; echo "dev-only=val-dev" >"$cwd/.env.local" ;;
  env) cp "$FIXTURES/$(cat "$cwd/.project").env" "$file" ;;
esac
`;

const GH = `#!/bin/sh
echo "gh $*" >>"$LOG"
case "$1 $2" in
  'auth status') exit "\${GH_AUTH:-0}" ;;
  'secret set'|'variable set') printf '%s %s %s=%s\\n' "$1" "\${4:-repo}" "$3" "$(cat)" >>"$WRITES" ;;
  'api repos/{owner}/{repo}/environments/'*)
    case " $MISSING_ENVS " in *" \${2##*/} "*) exit 1 ;; esac ;;
esac
exit 0
`;

const projects: Record<string, Record<string, string>> = {
  'approved-rs': {
    TELEGRAM_BOT_TOKEN: 'val-crm',
    TELEGRAM_BOT_USERNAME: 'val-crm-name',
    TELEGRAM_OWNER_ID: 'val-owner',
    PUBLIC_WHATSAPP_NUMBER: 'val-phone',
    PUBLIC_THREADS_CHANNEL: 'val-threads',
    VERCEL_OIDC_TOKEN: 'val-oidc',
    BLOB_READ_WRITE_TOKEN: 'val-blob',
    LEGACY_THING: 'val-legacy',
  },
  'auto-service': {
    TELEGRAM_BOT_TOKEN: 'val-crm',
    TELEGRAM_OWNER_ID: 'val-owner',
    PUBLIC_PHONE_NUMBER: 'val-phone',
    MEDUSA_BACKEND_URL: 'val-medusa',
    CRON_SECRET: 'val-cron',
    CRM_DATABASE_URL: 'val-db',
  },
  detailing: {
    TELEGRAM_BOT_TOKEN: 'val-crm',
    KEYSTATIC_SECRET: "val-it's",
    META_CAPI_TOKEN: 'val-meta',
  },
};

function migrate(
  args: string[],
  { values = projects, env = {} as Record<string, string> } = {},
) {
  const work = mkdtempSync(join(tmpdir(), 'env-to-github-test-'));
  for (const dir of ['bin', 'fixtures', 'tmp']) mkdirSync(join(work, dir));
  writeFileSync(join(work, 'bin/vercel'), VERCEL);
  writeFileSync(join(work, 'bin/gh'), GH);
  chmodSync(join(work, 'bin/vercel'), 0o755);
  chmodSync(join(work, 'bin/gh'), 0o755);
  for (const [app, vars] of Object.entries(values))
    writeFileSync(
      join(work, 'fixtures', `${app}.env`),
      Object.entries(vars)
        .map(([name, value]) => `${name}="${value}"\n`)
        .join(''),
    );
  writeFileSync(join(work, 'writes'), '');
  const run = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', script, ...args],
    {
      encoding: 'utf8',
      env: {
        PATH: `${join(work, 'bin')}:${process.env.PATH}`,
        TMPDIR: join(work, 'tmp'),
        LOG: join(work, 'log'),
        WRITES: join(work, 'writes'),
        FIXTURES: join(work, 'fixtures'),
        MISSING_ENVS: 'site-detailing',
        ...env,
      },
    },
  );
  return {
    status: run.status,
    output: run.stdout + run.stderr,
    log: readFileSync(join(work, 'log'), 'utf8'),
    writes: readFileSync(join(work, 'writes'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .sort(),
    leftovers: readdirSync(join(work, 'tmp')),
  };
}

test('a run writes each manifest name where the manifest puts it, from stdin', () => {
  const run = migrate([]);
  assert.equal(run.status, 0, run.output);
  assert.deepEqual(
    run.writes,
    [
      "secret --env=site-detailing KEYSTATIC_SECRET=val-it's",
      'secret --env=site-auto-service CRON_SECRET=val-cron',
      'secret repo TELEGRAM_BOT_TOKEN=val-crm',
      'secret repo TELEGRAM_OWNER_ID=val-owner',
      'variable --env=site-approved-rs PUBLIC_THREADS_CHANNEL=val-threads',
      'variable --env=site-approved-rs PUBLIC_WHATSAPP_NUMBER=val-phone',
      'variable --env=site-auto-service MEDUSA_BACKEND_URL=val-medusa',
      'variable repo PUBLIC_PHONE_NUMBER=val-phone',
      'variable repo TELEGRAM_BOT_USERNAME=val-crm-name',
    ].sort(),
  );
});

test('every Vercel project is pulled from production into a private temp dir that is gone afterwards', () => {
  const run = migrate([]);
  for (const app of ['approved-rs', 'auto-service', 'detailing']) {
    assert.match(
      run.log,
      new RegExp(
        `vercel link --yes --project ${app} --scope aleksey-zikrackiys-projects --cwd \\S+`,
      ),
    );
  }
  assert.equal(
    run.log.match(/vercel env pull \S+ --yes --environment=production/g)
      ?.length,
    3,
  );
  assert.deepEqual(run.leftovers, []);
});

test('a missing site environment is created, an existing one is left alone', () => {
  const run = migrate([]);
  assert.match(
    run.log,
    /gh api -X PUT repos\/\{owner\}\/\{repo\}\/environments\/site-detailing/,
  );
  assert.doesNotMatch(run.log, /-X PUT \S+site-auto-service/);
});

test('the output names what moved, what stayed behind and what is missing, never a value', () => {
  const run = migrate([]);
  assert.doesNotMatch(run.output, /val-/);
  assert.match(run.output, /TELEGRAM_BOT_TOKEN -> repository secret/);
  assert.match(run.output, /CRON_SECRET -> site-auto-service secret/);
  assert.match(run.output, /not migrated: LEGACY_THING \(approved-rs\)/);
  assert.match(run.output, /not migrated: META_CAPI_TOKEN \(detailing\)/);
  assert.match(run.output, /not migrated: CRM_DATABASE_URL \(auto-service\)/);
  assert.doesNotMatch(run.output, /VERCEL_OIDC_TOKEN|BLOB_READ_WRITE_TOKEN/);
  assert.match(run.output, /missing: TELEGRAM_GROUP_ID \(shared\)/);
  assert.match(run.output, /missing: KEYSTATIC_SECRET \(auto-service\)/);
});

test('a dry run pulls and reports but writes nothing to GitHub', () => {
  const run = migrate(['--dry-run']);
  assert.equal(run.status, 0, run.output);
  assert.deepEqual(run.writes, []);
  assert.doesNotMatch(run.log, /-X PUT/);
  assert.match(run.output, /TELEGRAM_BOT_TOKEN -> repository secret/);
  assert.match(run.output, /would create environment site-detailing/);
  assert.doesNotMatch(run.output, /val-/);
  assert.deepEqual(run.leftovers, []);
});

test('a shared value that differs stops everything, naming the variable and the projects only', () => {
  const run = migrate([], {
    values: {
      ...projects,
      detailing: { ...projects.detailing, TELEGRAM_OWNER_ID: 'val-other' },
    },
  });
  assert.equal(run.status, 1);
  assert.match(
    run.output,
    /TELEGRAM_OWNER_ID differs: approved-rs, auto-service \| detailing/,
  );
  assert.doesNotMatch(run.output, /val-/);
  assert.deepEqual(run.writes, []);
  assert.doesNotMatch(run.log, /gh (api|secret|variable)/);
  assert.deepEqual(run.leftovers, []);
});

test('a logged-out vercel or gh stops before anything is pulled', () => {
  for (const [env, tool] of [
    [{ VERCEL_WHOAMI: '1' }, 'vercel'],
    [{ GH_AUTH: '1' }, 'gh'],
  ] as const) {
    const run = migrate([], { env });
    assert.equal(run.status, 1);
    assert.match(run.output, new RegExp(`log in to ${tool}`));
    assert.doesNotMatch(run.log, /env pull/);
  }
});
