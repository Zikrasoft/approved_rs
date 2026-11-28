import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

type Job = {
  needs?: string | string[];
  if?: string;
  strategy?: { matrix?: Record<string, unknown> };
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

test('deploy-site waits for the static and sites jobs, translate and verify', () => {
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

test('the shop tests run as 6 shards', () => {
  assert.deepEqual(jobs.shop?.strategy?.matrix?.shard, [1, 2, 3, 4, 5, 6]);
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
