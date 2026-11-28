import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./shop-slow-issue.ts', import.meta.url).pathname;
const RUN = 'https://github.com/Zikrasoft/approved_rs/actions/runs/42';
const TITLE = 'Shop slow specs failed on main';

const GH = `#!/bin/sh
echo "$*" >>"$LOG"
[ "$1 $2" = "issue list" ] && printf '%s' "$OPEN"
exit 0
`;

function runWith(open: string) {
  const dir = mkdtempSync(join(tmpdir(), 'slow-issue-'));
  const gh = join(dir, 'gh');
  const log = join(dir, 'log');
  writeFileSync(gh, GH);
  chmodSync(gh, 0o755);
  writeFileSync(log, '');
  const result = spawnSync(
    'node',
    ['--experimental-strip-types', script, RUN],
    {
      env: { ...process.env, GH: gh, LOG: log, OPEN: open },
      encoding: 'utf8',
    },
  );
  const calls = readFileSync(log, 'utf8').trim().split('\n');
  return { status: result.status, calls };
}

test('opens a bug issue linking the run when none is open', () => {
  const { status, calls } = runWith('');
  assert.equal(status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /^issue list .*--state open/);
  assert.match(calls[1], /^issue create /);
  assert.ok(calls[1].includes(`--title ${TITLE}`));
  assert.ok(calls[1].includes('--label bug'));
  assert.ok(calls[1].includes(RUN));
});

test('comments on the open issue with the same title', () => {
  const { status, calls } = runWith('9');
  assert.equal(status, 0);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /^issue comment 9 /);
  assert.ok(calls[1].includes(RUN));
});

test('fails without a run url', () => {
  const result = spawnSync('node', ['--experimental-strip-types', script], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
});
