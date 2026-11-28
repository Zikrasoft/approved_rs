import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parse } from 'yaml';

const SHARDS = (
  parse(
    readFileSync(
      new URL('../workflows/ci.yml', import.meta.url).pathname,
      'utf8',
    ),
  ) as {
    jobs: { shop: { strategy: { matrix: { shard: number[] } } } };
  }
).jobs.shop.strategy.matrix.shard.length;
const shop = new URL('../../apps/auto-service-shop/', import.meta.url).pathname;

const jestList = (args: string[], slow = false): string[] =>
  execFileSync('pnpm', ['exec', 'jest', '--listTests', ...args], {
    cwd: shop,
    encoding: 'utf8',
    env: { ...process.env, SHOP_SLOW: slow ? 'true' : '' },
  })
    .split('\n')
    .filter(Boolean)
    .map((path) => relative(shop, path))
    .toSorted();

const specs = execFileSync(
  'git',
  ['ls-files', 'src/*/__tests__/*.spec.[jt]s'],
  {
    cwd: shop,
    encoding: 'utf8',
  },
)
  .split('\n')
  .filter(Boolean)
  .toSorted();
const isSlow = (path: string) => /\.slow\.spec\.[jt]s$/.test(path);

test('the shards run every spec that is not slow exactly once', () => {
  const sharded = Array.from({ length: SHARDS }, (_, i) =>
    jestList([`--shard=${i + 1}/${SHARDS}`]),
  ).flat();
  assert.ok(sharded.length > 0);
  assert.deepEqual(
    sharded.toSorted(),
    specs.filter((path) => !isSlow(path)),
  );
});

test('shop-slow runs exactly the slow specs', () => {
  const slow = specs.filter(isSlow);
  assert.ok(slow.length > 0);
  assert.deepEqual(jestList([], true), slow);
});
