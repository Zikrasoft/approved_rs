import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type Step = { uses?: string; run?: string; if?: string };
type Job = {
  needs?: string | string[];
  if?: string;
  strategy?: { matrix?: Record<string, unknown> };
  steps?: Step[];
};

const workflow = parse(
  readFileSync(
    new URL('../workflows/ci.yml', import.meta.url).pathname,
    'utf8',
  ),
) as { jobs: Record<string, Job> };
const jobs = workflow.jobs;

const TEST_JOBS = ['static', 'sites', 'infra', 'shop', 'shop-drift'];

const needsOf = (name: string): string[] => {
  const needs = jobs[name]?.needs ?? [];
  return typeof needs === 'string' ? [needs] : needs;
};

const upstreamOf = (name: string): Set<string> => {
  const seen = new Set<string>();
  const walk = (job: string) => {
    for (const need of needsOf(job)) {
      if (!seen.has(need)) {
        seen.add(need);
        walk(need);
      }
    }
  };
  walk(name);
  return seen;
};

test('deploy-site waits for the static and sites jobs, translate, verify and deploy-shop', () => {
  assert.deepEqual(needsOf('deploy-site').toSorted(), [
    'deploy-shop',
    'shop-image',
    'sites',
    'static',
    'translate',
    'verify',
  ]);
  assert.ok(!upstreamOf('deploy-site').has('shop-slow'));
});

test('deploy-shop waits for every shop test job, the infra job and the image', () => {
  assert.deepEqual(needsOf('deploy-shop').toSorted(), [
    'infra',
    'shop',
    'shop-drift',
    'shop-image',
    'static',
    'translate',
    'verify',
  ]);
});

test('no deploy waits for shop-slow', () => {
  for (const name of Object.keys(jobs).filter((job) =>
    job.startsWith('deploy-'),
  )) {
    assert.ok(!upstreamOf(name).has('shop-slow'), name);
  }
});

test('the shop shards are numbered from 1 and the local test default runs the same split', () => {
  const shards = jobs.shop?.strategy?.matrix?.shard as number[];
  assert.ok(shards.length > 1);
  assert.deepEqual(
    shards,
    Array.from({ length: shards.length }, (_, i) => i + 1),
  );
  const testScript = JSON.parse(
    readFileSync(
      new URL('../../apps/auto-service-shop/package.json', import.meta.url)
        .pathname,
      'utf8',
    ),
  ).scripts.test as string;
  assert.ok(
    testScript.includes(
      `\${SHOP_SHARDS:-${shards.map((n) => `${n}/${shards.length}`).join(' ')}}`,
    ),
    testScript,
  );
});

test('translate starts without waiting for a test job', () => {
  const upstream = upstreamOf('translate');
  for (const job of [...TEST_JOBS, 'shop-slow']) {
    assert.ok(!upstream.has(job), job);
  }
});

test('skip_check skips every test job and still lets both deploys run', () => {
  for (const job of TEST_JOBS) {
    assert.match(jobs[job]?.if ?? '', /!inputs\.skip_check/, job);
  }
  for (const deploy of ['deploy-site', 'deploy-shop']) {
    assert.match(jobs[deploy]?.if ?? '', /inputs\.skip_check/, deploy);
  }
});

test('the shop shards and shop-drift decide whether the shop is affected before installing', () => {
  for (const name of ['shop', 'shop-drift']) {
    const steps = jobs[name]?.steps ?? [];
    const decide = steps.findIndex((step) =>
      step.run?.includes('shop-affected.sh'),
    );
    assert.ok(decide >= 0, name);
    assert.ok(
      steps
        .slice(0, decide)
        .every((step) => step.uses === 'actions/checkout@v4'),
      name,
    );
    for (const step of steps.slice(decide + 1)) {
      assert.match(
        step.if ?? '',
        /outputs\.shop == 'true'/,
        `${name}: ${step.uses ?? step.run}`,
      );
    }
  }
});
